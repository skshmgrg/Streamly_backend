import mongoose from "mongoose"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const userSchema=new mongoose.Schema({
    username:{
        type:String,
        required:true,
        lowercase:true,
        trim:true,
        unique:true,
        index:true //if we want to search a field again and again then adding index is a better approach
    },
    email:{
        type:String,
        required:true,
        lowercase:true,
        trim:true,
        unique:true,
    },
    fullName:{
        type:String,
        required:true,
        trim:true,
        index:true
    },
    avatar:{
        type:String, // cloudinary url
        required:true
    },
    avatarPublicId:{
        type:String,
        required:true
    },
    coverImage:{
        type:String, // cloudinary url
    },
    coverImagePublicId:{
        type:String
    },
    watchHistory:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"Video"
        }
    ],
    password:{
        type:String,
        required:['true',"password is required"]
    },
    refreshToken:{
        type:String
    }


},{timestamps:true})

//only refresh token is stored in database 

//pre hook
userSchema.pre("save", async function(next){
    if(!this.isModified("password"))
        return next();
    this.password=await bcrypt.hash(this.password ,10)
    next()
})

// custom methods creation
userSchema.methods.isPasswordCorrect= async function(password)
{
    return await bcrypt.compare(password,this.password)
}
userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id:this._id,
            email:this.email,
            username:this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:process.env.ACCESS_TOKEN_EXPIRY
        } 
    )
}
userSchema.methods.generateRefreshToken = function(){
return jwt.sign(
    {
        _id:this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
        expiresIn:process.env.REFRESH_TOKEN_EXPIRY
    } 
)
}

export const User=mongoose.model("User",userSchema);