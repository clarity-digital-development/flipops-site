import { google, sheets_v4 } from 'googleapis';

let sheetsClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (!credentialsJson) {
    throw new Error('GOOGLE_SHEETS_CREDENTIALS environment variable is not set');
  }

  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

/**
 * Append a row to a Google Sheet.
 * Generic utility — each API route decides what columns to pass.
 */
export async function appendRow(
  spreadsheetId: string,
  sheetName: string,
  values: (string | number | null | undefined)[]
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}
