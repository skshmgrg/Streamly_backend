import mongoose from "mongoose";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { Subscription } from "../models/subscription.models.js";
import { Like } from "../models/like.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
  // const { userId } = req.params;
  const userId = req.user._id;
  // Step 1: Get user stats via aggregation
  const [userStats] = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "videos",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $addFields: {
        videoCount: { $size: "$videos" },
        viewCount:  { $sum: "$videos.views" },
        subscriberCount: { $size: "$subscribers" },
        videoIds: "$videos._id",
      },
    },
    {
      $project: {
        _id: 1,
        username: 1,
        avatar: 1,
        videoCount: 1,
        subscriberCount: 1,
        videoIds: 1,
        viewCount:1
      },
    },
  ]);
  
  if (!userStats) {
    throw new ApiError(404, "User not found");
  }

  // Step 2: Count likes on those videos
  const likeCount = await Like.countDocuments({
    video: { $in: userStats.videoIds },
});

  // Step 3: Send response
  const data = {
    _id: userStats._id,
    username: userStats.username,
    avatar: userStats.avatar,
    videoCount: userStats.videoCount,
    subscriberCount: userStats.subscriberCount,
    likeCount,
    viewCount:userStats.viewCount
};

  res
  .status(200)
  .json(new ApiResponse(200, data, "Dashboard stats fetched successfully"));
});


const getChannelVideos = asyncHandler(async (req, res) => {
  // const { userId } = req.params;
 const userId = req.user._id;
const page   = Number(req.query.page)  || 1;
const limit  = Number(req.query.limit) || 10;
const skip   = (page - 1) * limit;

// (Optional) verify user exists
if (!await User.exists({ _id: userId })) {
  throw new ApiError(404, "User not found");
}

// Aggregate videos
const videos = await Video.aggregate([
  { $match: { owner: userId } },
  { $sort:  { createdAt: -1 } },
  { $skip:  skip },
  { $limit: limit },
  {
    $lookup: {
      from:         "users",
      localField:   "owner",
      foreignField: "_id",
      as:           "owner"
    }
  },
  { $unwind: "$owner" },
  {
    $project: {
      title:       1,
      thumbnail:   1,
      views:       1,
      createdAt:   1,
      description: 1,
      duration:    1,
      owner: {
        _id:      "$owner._id",
        username: "$owner.username",
        avatar:   "$owner.avatar"
      }
    }
  }
]);

// Total count for pagination
const total  = await Video.countDocuments({ owner: userId });
const totalPages = Math.ceil(total / limit);

res.status(200).json(new ApiResponse(200, {
  videos,
  page,
  totalPages,
  total
}, "Videos fetched successfully"));
});


export { getChannelStats, getChannelVideos };








