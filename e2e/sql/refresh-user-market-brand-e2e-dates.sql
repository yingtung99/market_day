USE MarketDayDB;
GO

/*
  Refreshes the date-sensitive rows created by
  user-market-brand-e2e-test-data.sql.

  This script intentionally does not invent missing seed rows. It fails fast
  when the canonical events or brands are absent so a partial data set cannot
  be mistaken for a valid E2E environment.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @today DATE = CAST(SYSDATETIME() AS DATE);
DECLARE @now DATETIME2(0) = SYSDATETIME();

IF (SELECT COUNT(*) FROM dbo.market_events WHERE title = N'島嶼日和生活市集') <> 1
    THROW 51001, N'Expected exactly one 島嶼日和生活市集 seed row.', 1;

IF (SELECT COUNT(*) FROM dbo.market_events WHERE title = N'春日野餐市集') <> 1
    THROW 51002, N'Expected exactly one 春日野餐市集 seed row.', 1;

IF (SELECT COUNT(*) FROM dbo.vendor_profiles WHERE brand_name = N'日光小廚房') <> 1
    THROW 51003, N'Expected exactly one 日光小廚房 seed row.', 1;

IF (SELECT COUNT(*) FROM dbo.vendor_profiles WHERE brand_name = N'森日手作所') <> 1
    THROW 51004, N'Expected exactly one 森日手作所 seed row.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    UPDATE dbo.market_events
    SET start_at = DATEADD(HOUR, 10, CAST(@today AS DATETIME2(0))),
        end_at = DATEADD(HOUR, 18, DATEADD(DAY, 1, CAST(@today AS DATETIME2(0)))),
        location_name = N'審計新村368新創聚落',
        city = N'台中市',
        district = N'西區',
        address = N'民生路368巷',
        workflow_status = N'PUBLISHED',
        public_info_at = COALESCE(public_info_at, DATEADD(MINUTE, -1, @now)),
        brands_public_at = DATEADD(MINUTE, -1, @now)
    WHERE title = N'島嶼日和生活市集';

    UPDATE dbo.market_events
    SET start_at = DATEADD(HOUR, 10, DATEADD(DAY, -35, CAST(@today AS DATETIME2(0)))),
        end_at = DATEADD(HOUR, 18, DATEADD(DAY, -34, CAST(@today AS DATETIME2(0)))),
        location_name = N'審計新村368新創聚落',
        city = N'台中市',
        district = N'西區',
        address = N'民生路368巷',
        workflow_status = N'PUBLISHED',
        public_info_at = COALESCE(public_info_at, DATEADD(DAY, -36, @now)),
        brands_public_at = DATEADD(DAY, -36, @now)
    WHERE title = N'春日野餐市集';

    IF EXISTS (
        SELECT 1
        FROM dbo.market_events
        WHERE title IN (N'島嶼日和生活市集', N'春日野餐市集')
          AND (
              city <> N'台中市'
              OR district <> N'西區'
              OR location_name <> N'審計新村368新創聚落'
              OR address <> N'民生路368巷'
          )
    )
        THROW 51005, N'Canonical market location values failed exact-match validation.', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT
    title,
    city,
    district,
    location_name AS locationName,
    address,
    CAST(start_at AS DATE) AS startDate,
    CAST(end_at AS DATE) AS endDate,
    workflow_status AS workflowStatus,
    brands_public_at AS brandsPublicAt
FROM dbo.market_events
WHERE title IN (N'島嶼日和生活市集', N'春日野餐市集')
ORDER BY title;
GO
