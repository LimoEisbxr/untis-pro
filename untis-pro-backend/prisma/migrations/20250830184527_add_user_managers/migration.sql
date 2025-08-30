-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "isUserManager" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."AccessRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" TEXT NOT NULL,
    "message" TEXT,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_username_key" ON "public"."AccessRequest"("username");
