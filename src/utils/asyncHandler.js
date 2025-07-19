const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err))
        //next(err)means skip all normal middlewares and directly jump to the error handling middleware
        //requestHandler(req, res, next) returns a resolved or rejected promise
        //if it is resolved then we do nothing as there is no .then() after promise.resolve part
        //if it is rejected then we run .catch
        //we dont add a .then() block as -Because we don't need to do anything after the handler succeeds.
    }
}
export { asyncHandler }




// const asyncHandler = () => {}
// const asyncHandler = (func) => {() => {}}//just to understand
// const asyncHandler = (func) => () => {}
// const asyncHandler = (func) => async () => {}


// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success: false,
//             message: error.message
//         })
//     }
// }