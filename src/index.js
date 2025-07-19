// import dotenv from "dotenv"
// dotenv.config({
//     // path:"./.env"
// })
console.log('--- src/index.js startup ---');
console.log('process.env.CORS_ORIGIN at index.js start:', process.env.CORS_ORIGIN); // CHECK THIS!
console.log('--- End src/index.js startup debug ---');


import connectDB from "./db/index.js";
import app from "./app.js";


connectDB().then(()=>{
    app.listen(process.env.PORT||8000,()=>{
        console.log(`Server is running at port :${process.env.PORT}`);
    });
}).catch((err)=>{
    console.log("Mongo Db connection fail!!!",err)
});






















/*import express from "express";
const app=express();
;(async ()=>{
    try{
        await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
        app.on("error",(error)=>{
            console.log("ERR:",error);
            throw error;
        })
        app.listen(process.env.PORT,()=>{
            console.log(`App is listening on port ${process.env.PORT}`);
        })

    }catch(error){
        console.error("ERROR:",error);
        throw error;
    }

})()*/