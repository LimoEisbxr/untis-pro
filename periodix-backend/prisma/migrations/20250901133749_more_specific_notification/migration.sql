-- AlterTable
ALTER TABLE "public"."NotificationSettings" ADD COLUMN     "cancelledLessonsTimeScope" TEXT NOT NULL DEFAULT 'day',
ADD COLUMN     "irregularLessonsTimeScope" TEXT NOT NULL DEFAULT 'day';
