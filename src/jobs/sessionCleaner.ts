import cron from "node-cron";
import { UserAnalysis } from "../models/UserAnalysis";
import { LogoutUserService } from "../services/users/LogoutUserService";

const INACTIVITY_TIMEOUT_MINUTES = 10;

async function findAndLogoutInactiveUsers() {


    const logoutService = new LogoutUserService();
    const timeoutLimit = new Date(Date.now() - INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);

    try {
        const analysesWithInactiveSessions = await UserAnalysis.find({
            "sessions.sessionEnd": null,
            "sessions.lastActivityAt": { $lt: timeoutLimit }
        });

        if (analysesWithInactiveSessions.length === 0) {
            return;
        }



        for (const analysis of analysesWithInactiveSessions) {
            try {
                await logoutService.logout(analysis.userId);

            } catch (error: any) {

            }
        }
    } catch (error) {

    }
}

export function startSessionCleaner() {
    cron.schedule("*/5 * * * *", findAndLogoutInactiveUsers);


}