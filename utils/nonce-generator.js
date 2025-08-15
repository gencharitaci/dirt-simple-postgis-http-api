// utils/nonceGenerator.js

import crypto from "crypto";

export const generateNonce = () => {
    return crypto.randomBytes(16).toString('hex');
};