declare global {
  namespace Express {
    interface Request {
      user?: { id: string; displayName: string; email: string; role: 'USER' | 'ADMIN' };
      requestId?: string;
    }
  }
}
export {};
