import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user._id;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  // Check if the user already liked the video
  const existingLike = await Like.findOne({
    video: videoId,
    likedBy: userId
  });

  let liked;

  if (!existingLike) {
    // If not liked before → like it
    await Like.create({
      video: videoId,
      likedBy: userId
    });
    liked = true;
  } else {
    // If already liked → remove the like
    await existingLike.deleteOne();
    liked = false;
  }

  // Send response
  return res.status(200).json(
    new ApiResponse(200, { liked }, "Video like toggled successfully")
  );
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;

  // Optional: validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  const existingLike = await Like.findOne({
    comment: commentId,
    likedBy: userId
  });

  let liked;

  if (!existingLike) {
    await Like.create({
      comment:commentId,
      likedBy: userId
    });
    liked=true;
  } else {
    await existingLike.deleteOne();
    liked=false;
  }

  return res.status(200).json(
    new ApiResponse(200, {liked}, "Comment like toggled successfully")
  );
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const userId = req.user._id;

  // Validate tweetId
  if (!mongoose.Types.ObjectId.isValid(tweetId)) {
    throw new ApiError(400, "Invalid tweet ID");
  }

  const existingLike = await Like.findOne({
    tweet: tweetId,
    likedBy: userId
  });

  let liked;

  if (!existingLike) {
    await Like.create({
      tweet: tweetId,
      likedBy: userId
    });
    liked = true;
  } else {
    await existingLike.deleteOne();
    liked = false;
  }

  return res.status(200).json(
    new ApiResponse(200, { liked }, "Tweet like toggled successfully")
  );
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10 } = req.query;

  const pageInt = parseInt(page);
  const limitInt = parseInt(limit);
  const skip = (pageInt - 1) * limitInt;

  const liked = await Like.aggregate([
    {
      $match: {
        likedBy: userId,
        video: { $exists: true, $ne: null }
      }
    },
    {
      $sort: { createdAt: -1 } // latest likes first
    },
    {
      $skip: skip
    },
    {
      $limit: limitInt
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "videoData"
      }
    },
    {
      $unwind: "$videoData"
    },
    {
      $project: {
        _id: "$videoData._id",
        title: "$videoData.title",
        thumbnail: "$videoData.thumbnail",
        views: "$videoData.views",
        likedAt: "$createdAt"
      }
    }
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, liked, "Liked videos fetched successfully"));
});

const getLikesOnVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const likes = await Like.find({ video: videoId });

  return res.status(200).json(
    new ApiResponse(200, {likes}, "Likes fetched successfully")
  );
});





export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos , getLikesOnVideo };



