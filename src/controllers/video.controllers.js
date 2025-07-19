import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.models.js"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary,deleteFromCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType = "desc",
    userId
  } = req.query;

  const skip = (page - 1) * limit;
  const sortOrder = sortType === "asc" ? 1 : -1;

  const matchStage = {};

  // Text search filter
  if (query) {
    matchStage.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
      { tags: { $in: [new RegExp(query, "i")] } }
    ];
  }

  // Filter by user
  if (userId) {
    matchStage.owner = new mongoose.Types.ObjectId(userId);
  }

  const pipeline = [
    { $match: matchStage },
    { $sort: { [sortBy]: sortOrder } }, //[sortBy] is used because we need the name of a property (the key) to be determined at runtime, based on the value of a variable
    { $skip: parseInt(skip) },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner"
      }
    },
    { $unwind: "$owner" },
    {
      $project: {
        title: 1,
        description: 1,
        videoFile:1,
        thumbnail:1,
        views: 1,
        createdAt: 1,
        "owner._id": 1,
        "owner.username": 1,
        "owner.avatar": 1
      }
    }
  ];

  const videos = await Video.aggregate(pipeline);

  const total = await Video.countDocuments(matchStage);

  res.status(200).json(
    new ApiResponse(200, {
      videos,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      totalVideos: total
    }, "Videos fetched successfully")
  );
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const videoFile = req.files?.videoFile?.[0];  //If you configure multer for multiple file uploads,req.files.thumbnail will always be an array, even if only one file was uploaded for that field.
  const thumbnailFile = req.files?.thumbnail?.[0];

  if (!title || !description || !videoFile || !thumbnailFile) {
    throw new ApiError(400, "Title, description, video, and thumbnail are required");
  }

  const videoUpload = await uploadOnCloudinary(videoFile.path);
  const thumbnailUpload = await uploadOnCloudinary(thumbnailFile.path);

  if (!videoUpload || !thumbnailUpload) {
    throw new ApiError(500, "Cloudinary upload failed");
  }

  const video = await Video.create({
    title,
    description,
    videoPublicId:videoUpload.public_id,
    thumbnailPublicId:thumbnailUpload.public_id,
    videoFile: videoUpload.url,
    thumbnail: thumbnailUpload.url,
    duration: videoUpload.duration, // Cloudinary provides this
    owner: req.user._id,
  });

  res.status(201).json(
    new ApiResponse(201, video, "Video published successfully")
  );
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user._id;
  
  const video = await Video.findById(videoId)
  .populate({
    path: "owner",
    select: "username fullName avatar"
  });
  const user=req.user;
  
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  if (!user.watchHistory.includes(videoId)) {
  await Video.updateOne({ _id: videoId }, { $inc: { views: 1 } });
  await User.findByIdAndUpdate(userId, { $addToSet: { watchHistory: videoId } });
}

  res.status(200).json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  const thumbnailLocalPath = req.file?.path;

  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Video ID is missing or invalid");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this video");
  }

  if (title) video.title = title;
  if (description) video.description = description;

  if (thumbnailLocalPath) {
    const newThumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!newThumbnail) {
      throw new ApiError(400, "Error uploading new thumbnail to Cloudinary");
    }

    if (video.thumbnailPublicId) {
      const result = await deleteFromCloudinary(video.thumbnailPublicId, "image");
      if (!result || result.result !== "ok") {
        throw new ApiError(500, "Failed to delete the old thumbnail from Cloudinary");
      }
    }

    video.thumbnail = newThumbnail.url;
    video.thumbnailPublicId = newThumbnail.public_id;
  }

  const updatedVideo = await video.save();
  res.status(200).json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid or missing video ID");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }

  // Delete thumbnail from Cloudinary if exists
  if (video.thumbnailPublicId) {
    const result = await deleteFromCloudinary(video.thumbnailPublicId,"image");
    if (!result || result.result !== "ok") {
      throw new ApiError(500, "Failed to delete thumbnail from Cloudinary");
    }
  }
  
  if (video.videoPublicId) {
    const result =await deleteFromCloudinary(video.videoPublicId,"video");
    if (!result || result.result !== "ok") {
      throw new ApiError(500, "Failed to delete video from Cloudinary");
    }

}

  await video.deleteOne();

  res.status(200).json(
    new ApiResponse(200, null, "Video deleted successfully")
  );
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid or missing video ID");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to alter this video's publish status");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    { $set: { isPublished: !video.isPublished } },
    { new: true }
  );

  res.status(200).json(
    new ApiResponse(
      200,
      updatedVideo,
      `Video is now ${updatedVideo.isPublished ? "published" : "unpublished"}`
    )
  );
});




export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
}


