declare const router: import("express-serve-static-core").Router;
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
            };
        }
    }
}
export default router;
