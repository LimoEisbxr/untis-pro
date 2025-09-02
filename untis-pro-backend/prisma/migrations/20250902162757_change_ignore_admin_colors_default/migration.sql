-- Update existing users to have ignoreAdminColors = true (new default behavior)
UPDATE "public"."User" SET "ignoreAdminColors" = true WHERE "ignoreAdminColors" = false;

-- Change the default value for future users
ALTER TABLE "public"."User" ALTER COLUMN "ignoreAdminColors" SET DEFAULT true;