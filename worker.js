import 'dotenv/config';
import dns from 'node:dns';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'fluent-ffmpeg';
import { Worker } from 'bullmq';
import { DB_NAME } from './src/constants.js';
import { Video } from './src/models/video.models.js';
import { redisConnection } from './src/utils/redisConnection.js';
import { uploadOnCloudinary, uploadRawOnCloudinary } from './src/utils/cloudinary.js';

const findFfmpegExecutable = () => {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) return null;

  const wingetPackages = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
  if (!fs.existsSync(wingetPackages)) return null;

  const pending = [wingetPackages];
  while (pending.length) {
    const currentDir = pending.pop();
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.name.toLowerCase() === 'ffmpeg.exe') {
        return entryPath;
      }
    }
  }

  return null;
};

const ffmpegPath = findFfmpegExecutable();
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dns.setDefaultResultOrder('ipv4first');

const mongoUrl = `${process.env.MONGODB_URL}/${DB_NAME}`;

const connectToMongo = async () => {
  while (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(mongoUrl);
    } catch (error) {
      console.error('Worker MongoDB connection failed; retrying in 5 seconds:', error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};


const resolveJobFilePath = (filePath) => {
  // Normalize separators for the current OS
  const normalized = path.normalize(filePath);
  // If already absolute, return as-is; otherwise resolve relative to worker dir
  if (path.isAbsolute(normalized)) return normalized;
  return path.resolve(__dirname, normalized);
};

const renditions = [
  { name: '480p', width: 854, height: 480, bandwidth: 1400000 },
  { name: '720p', width: 1280, height: 720, bandwidth: 2800000 },
];

const transcodeToHls = (inputPath, renditionDir, rendition) => new Promise((resolve, reject) => {
  const outputPath = path.join(renditionDir, `${rendition.name}.m3u8`);
  const segmentPath = path.join(renditionDir, `${rendition.name}_%03d.ts`);
  const options = [
    '-map 0:v:0', '-map 0:a:0?', '-c:v libx264', '-preset veryfast', '-profile:v main',
    '-crf 20', `-vf scale=${rendition.width}:-2`,
    '-c:a aac', '-b:a 128k', '-ar 48000', '-sc_threshold 0', '-g 48', '-keyint_min 48',
    '-hls_time 6', '-hls_playlist_type vod', `-hls_segment_filename ${segmentPath}`,
  ];

  console.log(`FFmpeg HLS (${rendition.name}): input=${inputPath} output=${outputPath}`);
  ffmpeg(inputPath)
    .outputOptions(options)
    .output(outputPath)
    .on('end', resolve)
    .on('error', (err) => {
      console.error(`FFmpeg error (${rendition.name}):`, err.message);
      reject(err);
    })
    .run();
});

const createHlsAssets = async (inputPath, videoId) => {
  const outputDir = path.join(path.dirname(inputPath), `hls-${videoId}`);
  try {
    await fsp.rm(outputDir, { recursive: true, force: true });
    await fsp.mkdir(outputDir, { recursive: true });
    const uploadedAssets = [];
    const playlists = [];

    for (const rendition of renditions) {
      const renditionDir = path.join(outputDir, rendition.name);
      await fsp.mkdir(renditionDir, { recursive: true });
      await transcodeToHls(inputPath, renditionDir, rendition);

      const files = await fsp.readdir(renditionDir);
      const segmentUrls = {};
      for (const file of files.filter((name) => name.endsWith('.ts'))) {
        const upload = await uploadRawOnCloudinary(
          path.join(renditionDir, file),
          `streamly/hls/${videoId}/${rendition.name}/${file}`,
        );
        if (!upload) throw new Error(`HLS segment upload failed: ${file}`);
        segmentUrls[file] = upload.secure_url || upload.url;
        uploadedAssets.push(upload.public_id);
      }

      const playlistPath = path.join(renditionDir, `${rendition.name}.m3u8`);
      let playlist = await fsp.readFile(playlistPath, 'utf8');
      playlist = playlist.replace(/^([^#\r\n]+\.ts)$/gm, (file) => segmentUrls[file] || file);
      await fsp.writeFile(playlistPath, playlist);
      const playlistUpload = await uploadRawOnCloudinary(
        playlistPath,
        `streamly/hls/${videoId}/${rendition.name}.m3u8`,
      );
      if (!playlistUpload) throw new Error(`HLS playlist upload failed: ${rendition.name}`);
      uploadedAssets.push(playlistUpload.public_id);
      playlists.push({ ...rendition, url: playlistUpload.secure_url || playlistUpload.url });
    }

    const masterPath = path.join(outputDir, 'master.m3u8');
    const master = ['#EXTM3U', '#EXT-X-VERSION:3', ...playlists.flatMap((rendition) => [
      `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bandwidth},RESOLUTION=${rendition.width}x${rendition.height}`,
      rendition.url,
    ])].join('\n') + '\n';
    await fsp.writeFile(masterPath, master);
    const masterUpload = await uploadRawOnCloudinary(masterPath, `streamly/hls/${videoId}/master.m3u8`);
    if (!masterUpload) throw new Error('Master HLS playlist upload failed');
    uploadedAssets.push(masterUpload.public_id);
    return { masterUpload, uploadedAssets, playlists };
  } finally {
    await fsp.rm(outputDir, { recursive: true, force: true });
    await fsp.unlink(inputPath).catch(() => {});
  }
};

await connectToMongo();
console.log(`Worker connected to MongoDB at ${mongoose.connection.host}`);

const videoWorker = new Worker(
  'video-processing',
  async (job) => {
    try {
      console.log('Processing video job:', job.data);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const hls = await createHlsAssets(resolveJobFilePath(job.data.videoFilePath), job.data.videoId);
      const thumbnailUpload = await uploadOnCloudinary(resolveJobFilePath(job.data.thumbnailFilePath));

      if (!hls || !thumbnailUpload) {
        throw new Error(`Cloudinary upload failed for video ${job.data.videoId}`);
      }

      await Video.findByIdAndUpdate(job.data.videoId, {
        $set: {
          masterPlaylistUrl: hls.masterUpload.secure_url || hls.masterUpload.url,
          hlsPublicIds: hls.uploadedAssets,
          variants: hls.playlists.map(({ name, width, height, bandwidth, url }) => ({
            name,
            width,
            height,
            bandwidth,
            playlistUrl: url,
          })),
          thumbnail: thumbnailUpload.url,
          thumbnailPublicId: thumbnailUpload.public_id,
          status: 'ready',
        },
      });

      console.log(`Video ${job.data.videoId} marked ready`);
    } catch (error) {
      await Video.findByIdAndUpdate(job.data.videoId, {
        $set: { status: 'failed' },
      });
      throw error;
    } finally {
      await fsp.unlink(resolveJobFilePath(job.data.videoFilePath)).catch(() => {});
      await fsp.unlink(resolveJobFilePath(job.data.thumbnailFilePath)).catch(() => {});
    }
  },
  { connection: redisConnection }
);

videoWorker.on('completed', (job) => {
  console.log(`Video job ${job.id} completed`);
});

videoWorker.on('failed', (job, error) => {
  console.error(`Video job ${job?.id || 'unknown'} failed:`, error);
});

const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down worker`);
  await videoWorker.close();
  await redisConnection.quit();
  await mongoose.disconnect();
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
