import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary ,deleteFromCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { application, response } from "express";
import jwt from "jsonwebtoken";
import fs from 'fs'

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while generating access and refresh tokens"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  
  //get user data from frontend
  //validation- not empty
  //check if user already exists:username,email
  //check for images
  //check for avatar
  //upload them on cloudinary,avatar
  //create user object of user
  //create entry in db
  //remove password and refresh token field from response
  //check for user creation
  //return res

  const { fullName, email, username, password } = req.body;
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  // console.log(req)
if (!fullName?.trim()||!email?.trim()||!username?.trim()||!password?.trim()){
  if(fs.existsSync(avatarLocalPath))
  {
    fs.unlinkSync(avatarLocalPath);
  }
  if(fs.existsSync(coverImageLocalPath))
  {
    fs.unlinkSync(coverImageLocalPath);
  }
  throw new ApiError(400, "All fields are required");
}

const existedUser = await User.findOne({
  $or: [{ username }, { email }],
});

if (existedUser) {
    if(fs.existsSync(avatarLocalPath))
    {
      fs.unlinkSync(avatarLocalPath);
    }
    if(fs.existsSync(coverImageLocalPath))
    {
      fs.unlinkSync(coverImageLocalPath);
    }
    throw new ApiError(409, "user with this email or username already exists");
  }
  // console.log(req.files);  
  //these local paths may be there or may not be there
  
  if (!avatarLocalPath) {
    if(fs.existsSync(coverImageLocalPath))
    {
      fs.unlinkSync(coverImageLocalPath);
    }
    throw new ApiError(400, "Avatar file is required");
  }


  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    avatarPublicId:avatar?.public_id,
    coverImage: coverImage?.url || "",
    coverImagePublicId:coverImage?.public_id,
    email,
    password,
    username: username.toLowerCase(),
  });
  //_id field is automatically added by mongodb itself
  //.select method has weird syntax
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //req.body->data
  //username or email
  //finduser
  //check password
  //access and refresh token
  //send cookie

  // console.log("--- Inside loginUser Controller (Attempting JSON Parsing) ---");
  // console.log("Request Headers:", req.headers); // Check 'content-type'
  // console.log("Request Body:", req.body); // This should now show your JSON data
  // console.log("--- End Debug ---");

  const { email, username, password } = req.body;

  // console.log(req)

  if (!(username || email)) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  // console.log(user);

  if (!user) {
    throw new ApiError(404, "user doesnt exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );



  // Cookies are small pieces of data that the server sends to the client (browser), and the browser stores them and sends them back with every request to the same domain.
  const options = {
    httpOnly: true,//HttpOnly is a flag you set on a cookie to prevent JavaScript on the client side from accessing it.
    secure: true,//secure true makes the cookie only server modifiable , frontend cant modify it then
  };
  // console.log(res);

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
    //secure true makes the cookie only server modifiable , frontend cant modify it then
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    ); //this gives us the decoded token
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken != user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken},
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if(!oldPassword||!newPassword)
  {
    throw new ApiError(400,"Both new and old password are required");
  }

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid Password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!(fullName || email)) {
    throw new ApiError(400, "All fields are required");
  }
  const updateData={};
  if (fullName) updateData.fullName = fullName;
  if (email) updateData.email = email;

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: updateData
    },
    {
      new: true, //returns the new details of the user
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200,user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  //TODO: delete old image - assignment

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url || !avatar.public_id) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  const oldPublicId=req.user?.avatarPublicId;

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
        avatarPublicId:avatar.public_id
      },
    },
    { new: true }
  ).select("-password");

  const result = await deleteFromCloudinary(oldPublicId,"image");
  
  if (!result || result.result !== "ok") {
    // console.log(result)
    throw new ApiError(500, "Failed to delete the old file from Cloudinary");
  }
  
  return res
  .status(200)
  .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }
  
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  
  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }
  
  const oldPublicId=req.user?.coverImagePublicId;
  
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");
  
  if(oldPublicId)
    {
      const result = await deleteFromCloudinary(oldPublicId,"image");
      if (!result || result.result !== "ok") {
       throw new ApiError(500, "Failed to delete the old file from Cloudinary");
    }

  }
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }
  // User.find({username})

  const channel = await User.aggregate([
    //pipeline 1--- matching the user
    {
      $match: {
        username: username?.toLowerCase(),
      }
    },
    //pipeline 2 --- counting subscribers number through channel
    {
      $lookup: {
        from: "subscriptions", //all model names are converted to lowercase automatically in mongodb
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    //pipeline 3 --- subscribed To , through subscriber
    {
      // lookup gives An array of documents from the from collection (subscriptions in your case) that match the foreignField = localField.
      $lookup: {
        from: "subscriptions", //all model names are converted to lowercase automatically in mongodb
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    //pipeline 4 --- 2 3 fields more added to original user object
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] }, // in can see in both arrays and objects
            then: true,
            else: false,
          },
        },
      },
    },
    //pipeline 5 --- which all fields are required to send at the frontend
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  // console.log(channel);

  // an array of objects matching to and satisfying our pipelines is retured by the aggregate , so ,const channel is an array of objects , may it be only one object

  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  // req.user._id//doesnt give ObjectId('wrelfbjwejlrf') but only 'wrelfbjwejlrf', as mongoose takes care of the processing from object id('sdfasm') to string

  const user = await User.aggregate([

    //pipeline 1 --- mathing the user id to obtain the user
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id)
      }
    },
    //pipeline 2 --- loading the selected user's watchHistory
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",

        // The pipeline inside this lookup means you're performing additional logic on each matched video.
        // once we have got the watchHistory , the waychHistory constains a field owner , which we need to obtain it
        pipeline: [
          {
            $lookup: {
              from: "users", //from where to lookup
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              //now , as we dont require the whole of the user in the owner field , we will use project
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          // once we got the owner field , we recieve an array , but in real we need only the first value of the array as there will be only one owner
          {
            $addFields: {	//A stage that adds a new field or modifies an existing one
              owner: {//The name of the field you are modifying or creating 
                $first: "$owner",//This means: "take the first element of the array field named owner"
              }
            }
          }
        ]
      }
    }
  ])
// console.log(user[0].watchHistory)
return res
.status(200)
.json(
   new ApiResponse(200,user[0].watchHistory,"Watch History fetched successfully")
)

});

export {
  logoutUser,
  loginUser,
  registerUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
