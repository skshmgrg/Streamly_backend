import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs'
//file system (library by default present in node js)

// import dotenv from "dotenv";
// dotenv.config(); 

// the above work is handled in the start script itself

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})


const uploadOnCloudinary = async(localFilePath)=>{
    // console.log(localFilePath);
    try{
        if(!localFilePath)
        return null
        //upload the file on cloudinary
        const response =await cloudinary.uploader.upload(localFilePath,{
            resource_type:'auto'
        })
        //file has been uploaded successfully
        // console.log("File is uploaded on cloudinary",response.url);
        fs.unlinkSync(localFilePath) //remove the locally saved temporary file as the upload operation passed
        return response;
    } catch(error){
        console.error("Cloudinary upload error:", error);
        fs.unlinkSync(localFilePath) //remove the locally saved temporary file as the upload operation failed
        return null;
    }
}
const deleteFromCloudinary = async(public_id,resourceType)=>{
    // console.log(localFilePath);
    try{
        if(!public_id)
        return null
        //delete the file on cloudinary
        const response =await cloudinary.uploader.destroy(public_id,{
            resource_type:resourceType
        })
        //file has been deleted successfully
        // console.log("File is deleted from cloudinary",response.url);
        // fs.unlinkSync(localFilePath) //remove the locally saved temporary file as the upload operation passed
        return response;
    } catch(error){
        // fs.unlinkSync(localFilePath) //remove the locally saved temporary file as the upload operation failed
        console.error("Cloudinary delete error:", error);
        return null;
    }
}

export {uploadOnCloudinary,deleteFromCloudinary}