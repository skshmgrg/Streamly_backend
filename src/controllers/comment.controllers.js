import mongoose from "mongoose"
import {Comment} from "../models/comment.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video

    const {videoId} = req.params
    if(!mongoose.Types.ObjectId.isValid(videoId))
    {
        throw new ApiError(400,"Invalid video Id");
    }
    const {page = 1, limit = 10} = req.query //req.query.page and req.query.limit come from the URL, like this:/api/comments/abc123?page=2&limit=10  So page and limit are strings (e.g. "2" not 2).
    const pageInt=parseInt(page);//from string to number conversion
    const limitInt=parseInt(limit);//from string to number conversion
    const skip = (pageInt-1)*limitInt;//This tells MongoDB how many documents to skip.
    
    const totalComments = await Comment.countDocuments({ video: videoId })
    
    const comments=await Comment.aggregate([
        {
            $match:{
                video:new mongoose.Types.ObjectId(videoId)
            },
        },
        {
            $sort:{createdAt :-1}//newest comments first // decreasing order of created at time
        },
        {
            $skip:skip
        },
        {
            $limit:limitInt
        }
        ,// now we require comment owner
        {
            $lookup:{
                from:'users',
                localField:'owner',
                foreignField:'_id',
                as:'owner',
                pipeline:[{
                    $project:{
                        _id:1,
                        avatar:1,
                        username:1
                    }
                }]
            }
        },
        {
            $addFields:{
                owner:{
                    $first:"$owner"
                }
            }
        },
        {
            $project: {
                _id: 1,
                content: 1,
                createdAt: 1,
                video: 1,
                owner: 1
            }
        }
    ])
    
    
    res.status(200).json(
        new ApiResponse(200, {
            totalComments,
            totalPages: Math.ceil(totalComments / limitInt),
            currentPage: pageInt,
            commentsReturned: comments.length,
            comments
        }, "Comments fetched successfully")
    );
    
})

const addComment = asyncHandler(async (req, res) => {
    
    // TODO: add a comment to a video
    const {videoId} = req.params;
    const {commentContent}=req.body;

    if (!commentContent?.trim()) {
    throw new ApiError(400, "Comment content is missing");
  }

    const comment=new Comment({
        content:commentContent.trim(),
        video:videoId,
        owner:req.user._id
    })
    
    await comment.save();

    res.status(201).json(new ApiResponse(201,comment,"Comment Added Successfully"))
    
})

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { commentContent } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
      throw new ApiError(400, "Invalid comment ID");
    }
    
    if (!commentContent?.trim()) {
        throw new ApiError(400, "Comment content cannot be empty");
    }
    
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }
    
    if (!comment.owner.equals(req.user._id)) {
        throw new ApiError(403, "You are not authorized to update this comment");
    }
    
    
    comment.content = commentContent.trim();
    await comment.save(); 
    
    res.status(200).json(
        new ApiResponse(200, comment, "Comment updated successfully")
    );
});

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const { commentId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }
    
    if (!comment.owner.equals(req.user._id)) {
        throw new ApiError(403, "You are not authorized to delete this comment");
    }

    await comment.deleteOne();
    return res.status(200).json(new ApiResponse(200,null,"comment deleted successfully"));
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
}