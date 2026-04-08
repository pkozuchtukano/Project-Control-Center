import { handleYouTrackRequest } from '../../server/youtrackProxy';

type HandlerEvent = {
  body?: string | null;
};

type HandlerResponse = {
  statusCode: number;
  body: string;
};

type Handler = (event: HandlerEvent) => Promise<HandlerResponse>;

const baseUrl = process.env.YOUTRACK_BASE_URL?.trim() || process.env.VITE_YOUTRACK_BASE_URL?.trim() || '';
const token = process.env.YOUTRACK_TOKEN?.trim() || process.env.VITE_YOUTRACK_TOKEN?.trim() || '';

export const handler: Handler = async (event) => handleYouTrackRequest(event.body ?? undefined, { baseUrl, token });
