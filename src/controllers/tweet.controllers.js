import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.models.js"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getUserTweets = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const tweets = await Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $unwind: "$owner",
    },
    {
      $project: {
        content: 1,
        createdAt: 1,
        updatedAt: 1,
        "owner._id": 1,
        "owner.username": 1,
        "owner.avatar": 1,
      },
    },
  ]);

  // Optional: Count total tweets for pagination metadata
  const totalTweets = await Tweet.countDocuments({ owner: req.user._id });

  res.status(200).json(
    new ApiResponse(200, {
      tweets,
      page,
      limit,
      totalPages: Math.ceil(totalTweets / limit),
      totalTweets,
    }, "User tweets fetched successfully")
  );
});

const createTweet = asyncHandler(async (req, res) => {
    
    // TODO: create a tweet
    const {tweetContent}=req.body;

    if (!tweetContent?.trim()) {
    throw new ApiError(400, "Tweet content is missing");
  }

    const tweet=new Tweet({
        content:tweetContent.trim(),
        owner:req.user._id
    })
    
    await tweet.populate("owner", "username avatar");

    await tweet.save();

    res.status(201).json(new ApiResponse(201,tweet,"Tweet created Successfully"))
    
})

const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { tweetContent } = req.body;

  if (!tweetContent?.trim()) {
    throw new ApiError(400, "Tweet content is missing");
  }

  const tweet = await Tweet.findOne({ _id: tweetId, owner: req.user._id });

  if (!tweet) {
    throw new ApiError(404, "Tweet not found or unauthorized");
  }

  tweet.content = tweetContent.trim();
  await tweet.save();

  res.status(200).json(new ApiResponse(200, tweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  const tweet = await Tweet.findOneAndDelete({ _id: tweetId, owner: req.user._id });

  if (!tweet) {
    throw new ApiError(404, "Tweet not found or unauthorized");
  }

  res.status(200).json(new ApiResponse(200, null, "Tweet deleted successfully"));
});

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}




