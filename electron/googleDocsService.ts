import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import path from 'path';
import fs from 'fs/promises';
import { shell } from 'electron';

export class GoogleDocsService {
  private oauth2Client: OAuth2Client | null = null;
  private tokenPath: string;

  constructor(userDataPath: string) {
    this.tokenPath = path.join(userDataPath, '.google-tokens.json');
  }

  async setCredentials(clientId: string, clientSecret: string) {
    console.log('GoogleDocsService: Setting credentials...', { clientId: clientId?.substring(0, 10) + '...' });
    this.oauth2Client = new OAuth2Client(
      clientId,
      clientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );
    console.log('GoogleDocsService: oauth2Client initialized:', !!this.oauth2Client);

    // Try to load existing tokens
    try {
      const tokensRaw = await fs.readFile(this.tokenPath, 'utf-8');
      const tokens = JSON.parse(tokensRaw);
      this.oauth2Client.setCredentials(tokens);
    } catch (e) {
      // No tokens yet
    }
  }

  async getAuthStatus() {
    if (!this.oauth2Client) return { isAuthenticated: false, hasCredentials: false };
    const hasTokens = !!this.oauth2Client.credentials.access_token;
    return { 
      isAuthenticated: hasTokens, 
      hasCredentials: !!this.oauth2Client 
    };
  }

  getAuthUrl() {
    if (!this.oauth2Client) throw new Error('Credentials not set');
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/documents'],
      prompt: 'consent'
    });
  }

  async authorize(code: string) {
    if (!this.oauth2Client) throw new Error('Credentials not set');
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    await fs.writeFile(this.tokenPath, JSON.stringify(tokens));
    return tokens;
  }

  async logout() {
    try {
      await fs.unlink(this.tokenPath);
      if (this.oauth2Client) {
        this.oauth2Client.setCredentials({});
      }
    } catch (e) {
      // Ignore
    }
  }

  private extractDocId(url: string): string {
    const match = url.match(/\/d\/([^/]+)/);
    return match ? match[1] : url;
  }

  async appendNote(docLink: string, title: string, participants: string[], content: string) {
    if (!this.oauth2Client) throw new Error('Not authenticated');

    const docId = this.extractDocId(docLink);
    const docs = google.docs({ version: 'v1', auth: this.oauth2Client });

    // 1. Get document to find the end index
    const doc = await docs.documents.get({ documentId: docId });
    const endIndex = (doc.data.body?.content?.slice(-1)[0]?.endIndex || 1) - 1;

    // 2. Prepare formatting
    const timestamp = new Date().toLocaleString('pl-PL');
    const headerText = `\n\n------------------------------------------------\nNOTATKA: ${title}\nData: ${timestamp}\n`;
    const participantsText = `Uczestnicy:\n${participants.map(p => `- ${p}`).join('\n')}\n\n`;
    
    // Simple text for now, can be improved to handle basic HTML if needed
    // Stripping HTML tags for the text append
    const cleanContent = content.replace(/<[^>]*>/g, (tag) => {
        if (tag === '</p>' || tag === '<br>' || tag === '<br/>' || tag === '</li>') return '\n';
        return '';
    }).replace(/&nbsp;/g, ' ');

    const fullTextToAppend = `${headerText}${participantsText}${cleanContent}\n`;

    const requests = [
      {
        insertText: {
          location: { index: endIndex },
          text: fullTextToAppend
        }
      },
      {
        updateTextStyle: {
          range: {
            startIndex: endIndex + 2, // After \n\n
            endIndex: endIndex + headerText.length
          },
          textStyle: {
            bold: true,
            fontSize: { magnitude: 14, unit: 'PT' }
          },
          fields: 'bold,fontSize'
        }
      }
    ];

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests }
    });

    return { success: true };
  }
}
