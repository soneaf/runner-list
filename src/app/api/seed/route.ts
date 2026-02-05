import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextResponse } from 'next/server';

// Auth Logic
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getDoc(req: Request) {
    let sheetId = process.env.GOOGLE_SHEET_ID;
    const customId = req.headers.get('x-custom-sheet-id');
    if (customId && customId.length > 10) {
        sheetId = customId;
    }
    if (!sheetId) throw new Error('No Sheet ID provided');

    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();
    return doc;
}

export async function POST(req: Request) {
    try {
        const doc = await getDoc(req);

        // 1. Seed Runners
        const runnerSheet = doc.sheetsByTitle['Runners'];
        if (runnerSheet) {
            // Check if runners exist, if not, add them
            const existingRunners = await runnerSheet.getRows();
            if (existingRunners.length === 0) {
                const mockRunners = [
                    { Name: 'Steven', Phone: '555-0101', City: 'New York', Active: 'TRUE', Cash: 150, ContactType: 'whatsapp', Color: '#6366f1' },
                    { Name: 'Jessica', Phone: '555-0102', City: 'Chicago', Active: 'TRUE', Cash: 500, ContactType: 'cell', Color: '#10b981' },
                    { Name: 'Marcus', Phone: '555-0103', City: 'Los Angeles', Active: 'TRUE', Cash: 50, ContactType: 'cell', Color: '#f43f5e' },
                    { Name: 'Sarah', Phone: '555-0104', City: 'London', Active: 'TRUE', Cash: 1200, ContactType: 'whatsapp', Color: '#f59e0b' },
                    { Name: 'David', Phone: '555-0105', City: 'Toronto', Active: 'TRUE', Cash: 0, ContactType: 'cell', Color: '#06b6d4' }
                ];
                await runnerSheet.addRows(mockRunners);
            }
        }

        // 2. Seed Requests
        const requestSheet = doc.sheetsByIndex[0];

        // Ensure headers
        await requestSheet.loadHeaderRow();
        const headers = requestSheet.headerValues;
        const requiredHeaders = ['id', 'name', 'item', 'status', 'runner', 'mobile', 'timestamp', 'dept', 'store', 'cost', 'image_url', 'Show Date', 'City', 'Venue', 'email'];
        const newHeaders = [...new Set([...headers, ...requiredHeaders])];
        if (newHeaders.length > headers.length) await requestSheet.setHeaderRow(newHeaders);

        // Generate 50 Mock Items
        const departments = ['Audio', 'Lighting', 'Video', 'Production', 'Catering', 'Wardrobe'];
        const statuses = ['Pending', 'Assigned', 'Sent', 'Purchased', 'Completed'];
        const runners = ['Steven', 'Jessica', 'Marcus', 'Sarah', 'David'];
        const today = new Date().toISOString().split('T')[0];

        const mockRequests = [];
        for (let i = 0; i < 50; i++) {
            const status = statuses[i % 5]; // Even distribution
            const dept = departments[i % 6];
            const runner = status !== 'Pending' ? runners[i % 5] : '';
            const cost = (status === 'Purchased' || status === 'Completed') ? (Math.random() * 100).toFixed(2) : '';

            mockRequests.push({
                id: crypto.randomUUID(),
                timestamp: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString(), // Random past time
                name: `Crew Member ${i + 1}`,
                mobile: '555-0000',
                email: 'crew@example.com',
                dept: dept,
                item: `Mock Item ${i + 1} - ${dept} Supplies`,
                store: i % 3 === 0 ? 'Amazon' : i % 3 === 1 ? 'Home Depot' : 'Whole Foods',
                image_url: '',
                status: status,
                runner: runner,
                cost: cost,
                'Show Date': today,
                City: 'Mock City',
                Venue: 'Mock Arena'
            });
        }

        await requestSheet.addRows(mockRequests);

        return NextResponse.json({ success: true, message: 'Seeded 50 requests and runners' });

    } catch (error: any) {
        console.error('Seed Error:', error);
        return NextResponse.json({ error: 'Failed to seed data', details: error.message }, { status: 500 });
    }
}
