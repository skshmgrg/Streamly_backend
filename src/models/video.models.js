import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
    {
        videoFile: {
            type: String, //cloudinary url
            required: true
        },
        videoPublicId:{
            type:String,
            required:true
        },
        thumbnail: {
            type: String, //cloudinary url
            required: true
        },
        thumbnailPublicId:{
            type:String,
            required:true
        },
        title: {
            type: String, 
            required: true
        },
        description: {
            type: String, 
            required: true
        },
        duration: {
            type: Number, 
            required: true
        },
        views: {
            type: Number,
            default: 0
        },
        isPublished: {
            type: Boolean,
            default: true
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    }, 
    {
        timestamps: true
    }
)

videoSchema.plugin(mongooseAggregatePaginate)
// A plugin in Mongoose is like an extension or add-on that adds extra features to your schemas or models.
// Think of it like adding new capabilities (e.g., pagination, timestamps, soft delete) to your schema without writing all the logic yourself.


// .aggregate() is used when you want to do more complex stuff.
// Example:
// "Get only travel videos, sort them by views, then group them by year."
// You can't do such things with just .find(). For that, you use .aggregate().


export const Video = mongoose.model("Video", videoSchema)