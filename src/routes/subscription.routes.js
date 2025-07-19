import { Router } from 'express';
import {
    getSubscribedChannels,
    getSubscriberNumber,
    getUserChannelSubscribers,
    toggleSubscription,
    getUserSubscriptionStatus
} from "../controllers/subscription.controllers.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router
    .route("/c/:channelId")
    .get(getSubscribedChannels)
    .post(toggleSubscription);

router.route("/u/:subscriberId").get(getUserChannelSubscribers);
router.route("/count").get(getSubscriberNumber)
router.route("/status").get(getUserSubscriptionStatus)

export default router