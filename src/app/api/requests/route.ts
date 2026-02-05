import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import path from 'path';
import { writeFile } from 'fs/promises';

// 1. Authenticate with Google
// 1. Authenticate with Google
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
    ],
});

// Helper to get Sheet instance based on Request Header (for Multi-Tenancy)
async function getDoc(req: Request | null) {
    let sheetId = process.env.GOOGLE_SHEET_ID;

    if (req) {
        const customId = req.headers.get('x-custom-sheet-id');
        if (customId && customId.length > 10) {
            sheetId = customId;
        }
    }

    if (!sheetId) throw new Error('No Sheet ID provided');

    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();
    return doc;
}

// GET: Fetch all requests
export async function GET(req: Request) {
    try {
        const doc = await getDoc(req);
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        const data = rows.map((row) => ({
            id: row.get('id'),
            name: row.get('name'),
            item: row.get('item'),
            status: row.get('status'),
            runner: row.get('runner'),
            mobile: row.get('mobile') || row.get('email'), // Read from either column
            phone: row.get('mobile') || row.get('Phone') || row.get('email'),
            timestamp: row.get('timestamp'),
            dept: row.get('dept'),
            store: row.get('store') || null,
            image_url: row.get('image_url') || null,
            cost: row.get('cost') || null, // NEW
        }));

        return NextResponse.json(data);
    } catch (error) {
        console.error('Sheet Error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

// POST: Add new requests (handles multiple items)
export async function POST(req: Request) {
    try {
        const body = await req.json(); // { name, mobile, dept, items: [{ desc, imageBase64 }] }
        const { name, mobile, dept, items } = body;

        const doc = await getDoc(req);
        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();

        // Ensure headers exist
        const headers = sheet.headerValues;
        const newHeaders = [...headers];
        if (!newHeaders.includes('image_url')) newHeaders.push('image_url');
        if (!newHeaders.includes('cost')) newHeaders.push('cost'); // NEW
        if (newHeaders.length > headers.length) await sheet.setHeaderRow(newHeaders);

        const drive = google.drive({ version: 'v3', auth });

        // Check Schedule for "Today"
        const scheduleSheet = doc.sheetsByTitle['Schedule'];
        let todayInfo: any = null;
        const uploadWarnings: string[] = [];
        const todayDate = new Date().toISOString().split('T')[0];

        if (scheduleSheet) {
            const scheduleRows = await scheduleSheet.getRows();
            todayInfo = scheduleRows.find(row => row.get('Date') === todayDate);
        }

        for (const item of items) {
            let imageUrl = '';

            // Handle Image Upload
            if (item.imageBase64) {
                try {
                    // OPTION 1: ImgBB (Preferred if Key exists)
                    if (process.env.IMGBB_API_KEY) {
                        const formData = new FormData();
                        // Strip prefix if present, though ImgBB handles both usually. Safer to strip.
                        const cleanBase64 = item.imageBase64.replace(/^data:image\/\w+;base64,/, '');
                        formData.append('image', cleanBase64);

                        const res = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, {
                            method: 'POST',
                            body: formData,
                        });

                        const data = await res.json();
                        if (data.success) {
                            imageUrl = data.data.url;
                        } else {
                            throw new Error(data.error?.message || 'ImgBB upload failed');
                        }
                    }
                    // OPTION 2: Local Filesystem Storage (Reliable for Self-Hosted/Dev)
                    else {
                        const base64Data = item.imageBase64.split(',')[1];
                        const buffer = Buffer.from(base64Data, 'base64');

                        // Generate unique filename
                        const filename = `img_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
                        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
                        const filePath = path.join(uploadDir, filename);

                        // Ensure directory exists (redundant check but safe)
                        // await mkdir(uploadDir, { recursive: true }); // imported from fs/promises

                        await writeFile(filePath, buffer);

                        // Set URL relative to the public folder
                        imageUrl = `/uploads/${filename}`;
                    }
                } catch (uploadErr: any) {
                    console.error('Image Upload Failed:', uploadErr);
                    uploadWarnings.push(`Image upload failed for "${item.desc}": ${uploadErr.message}`);
                }
            }

            // Add Row
            // Robustness: Send to both 'mobile' and 'email' keys to ensure it lands in the correct column depending on header state.
            await sheet.addRow({
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                name,
                mobile: mobile,
                email: mobile, // Fallback: If header is still 'email', save mobile number there
                dept,
                item: item.desc,
                store: item.store || '',
                image_url: imageUrl,
                status: 'Pending',
                'Show Date': todayDate,
                City: todayInfo ? todayInfo.get('City') : 'Unknown',
                Venue: todayInfo ? todayInfo.get('Venue') : 'TBD',
            });
        }

        return NextResponse.json({
            message: 'Success',
            warnings: uploadWarnings.length > 0 ? uploadWarnings : undefined
        });
    } catch (error: any) {
        console.error('Sheet Error:', error);
        console.error('Service Account Email:', auth.email);
        return NextResponse.json({
            error: 'Failed to save data',
            details: error.message,
            tip: error.message.includes('403') ? `Please ensure you have invited ${auth.email} as an Editor to your Google Sheet.` : undefined
        }, { status: 500 });
    }
}

// PATCH: Update Status (For Coordinator assigning/Runner buying)
export async function PATCH(req: Request) {
    try {
        const body = await req.json(); // Expects { id, status, runner, cost }

        const doc = await getDoc(req);
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        // Find row by ID
        // Note: iterating rows isn't most efficient for huge sheets, but fine for this scale
        const rowToUpdate = rows.find(row => row.get('id') === body.id);

        if (rowToUpdate) {
            if (body.status) rowToUpdate.assign({ status: body.status });
            if (body.runner) rowToUpdate.assign({ runner: body.runner });
            if (body.cost) rowToUpdate.assign({ cost: body.cost }); // NEW
            await rowToUpdate.save();

            // TODO: If status === 'Completed', trigger email function here
            return NextResponse.json({ message: 'Updated' });
        }

        return NextResponse.json({ error: 'Row not found' }, { status: 404 });
    } catch (error) {
        console.error('Sheet Error:', error);
        return NextResponse.json({ error: 'Failed to update data' }, { status: 500 });
    }
}

// DELETE: Remove a request
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const doc = await getDoc(req);
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        const rowToDelete = rows.find(row => row.get('id') === id);

        if (rowToDelete) {
            await rowToDelete.delete();
            return NextResponse.json({ message: 'Deleted' });
        }

        return NextResponse.json({ error: 'Row not found' }, { status: 404 });
    } catch (error) {
        console.error('Sheet Error:', error);
        return NextResponse.json({ error: 'Failed to delete data' }, { status: 500 });
    }
}
