-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssetType" ADD VALUE 'MARQUEE';
ALTER TYPE "AssetType" ADD VALUE 'CAMPAIGN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Orientation" ADD VALUE 'LANDSCAPE_43';
ALTER TYPE "Orientation" ADD VALUE 'PORTRAIT_34';

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "fixedDuration" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "frameId" TEXT,
ADD COLUMN     "layoutConfig" JSONB,
ADD COLUMN     "marqueeConfig" JSONB,
ADD COLUMN     "transition" TEXT NOT NULL DEFAULT 'FADE';

-- AlterTable
ALTER TABLE "Screen" ADD COLUMN     "customBgUrl" TEXT,
ADD COLUMN     "lastSnapshotUrl" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "snapshotAt" TIMESTAMP(3),
ADD COLUMN     "systemInfo" JSONB,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ScreenCommand" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreenCommand_screenId_idx" ON "ScreenCommand"("screenId");

-- CreateIndex
CREATE INDEX "ScreenCommand_status_idx" ON "ScreenCommand"("status");

-- AddForeignKey
ALTER TABLE "ScreenCommand" ADD CONSTRAINT "ScreenCommand_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_frameId_fkey" FOREIGN KEY ("frameId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
