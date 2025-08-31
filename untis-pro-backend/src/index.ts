import dotenv from 'dotenv';
import app from './app.js';
import { notificationService } from './services/notificationService.js';

dotenv.config();

const port = Number(process.env.PORT || 3001);

app.listen(port, async () => {
    console.log(`Backend running on http://localhost:${port}`);
    
    // Start the notification service
    try {
        await notificationService.startService();
    } catch (error) {
        console.error('Failed to start notification service:', error);
    }
});
