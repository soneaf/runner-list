import { google } from 'googleapis';
import path from 'path';

const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
];
const KEY_FILE_PATH = path.join(process.cwd(), 'secrets.json');

export async function getAuthClient() {
    // Priority: Use Environment Variables (Best for Netlify/Vercel)
    if (process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
        return new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: SCOPES,
        }).getClient();
    }

    // Fallback: Use local secrets.json file (Best for local dev if not using .env)
    const auth = new google.auth.GoogleAuth({
        keyFile: KEY_FILE_PATH,
        scopes: SCOPES,
    });
    return await auth.getClient();
}

export async function getGoogleSheets() {
    const client = await getAuthClient();
    return google.sheets({ version: 'v4', auth: client as any });
}

export async function getGoogleDrive() {
    const client = await getAuthClient();
    return google.drive({ version: 'v3', auth: client as any });
}
