USE MarketDayDB;
GO

/* Required by SQL Server when writing tables that have filtered indexes,
   indexed computed columns, or indexed views. Keep these settings in the
   same batch as the seed statements. */
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* =========================================================
   Public market / brand Real API E2E seed

   Covers:
   - e2e/user/user-market.spec.ts
   - e2e/user/user-brand.spec.ts

   Properties:
   - transaction + XACT_ABORT
   - repeatable by canonical email/title/application number
   - dates are relative to the execution date
   - does not delete unrelated application data
   ========================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/*
  The companion run-e2e-seed.ps1 supplies these SQLCMD variables from
  front/market_day/market_day/.env.e2e.local. Do not put plaintext passwords
  in this SQL file.
*/
DECLARE @e2eVendorEmail VARCHAR(255) = '$(E2E_VENDOR_EMAIL)';
DECLARE @e2eVendorPasswordHash VARCHAR(255) = '$(E2E_VENDOR_PASSWORD_HASH)';
DECLARE @e2eOrganizerEmail VARCHAR(255) = '$(E2E_ORGANIZER_EMAIL)';
DECLARE @e2eOrganizerPasswordHash VARCHAR(255) = '$(E2E_ORGANIZER_PASSWORD_HASH)';
DECLARE @e2eAdminEmail VARCHAR(255) = '$(E2E_ADMIN_EMAIL)';
DECLARE @e2eAdminPasswordHash VARCHAR(255) = '$(E2E_ADMIN_PASSWORD_HASH)';

DECLARE @today DATE = CAST(SYSDATETIME() AS DATE);
DECLARE @now DATETIME2(0) = SYSDATETIME();

DECLARE @organizerEmail VARCHAR(255) = 'island.days.organizer@marketday.local';
DECLARE @foodVendorEmail VARCHAR(255) = 'sunlight.kitchen@marketday.local';
DECLARE @craftVendorEmail VARCHAR(255) = 'forest.craft@marketday.local';

DECLARE @currentTitle NVARCHAR(200) = N'島嶼日和生活市集';
DECLARE @secondCurrentTitle NVARCHAR(200) = N'城市微光散步市集';
DECLARE @historyTitle NVARCHAR(200) = N'春日野餐市集';

DECLARE @organizerUserId BIGINT;
DECLARE @organizerUserProfileId BIGINT;
DECLARE @foodVendorUserId BIGINT;
DECLARE @foodVendorUserProfileId BIGINT;
DECLARE @foodVendorProfileId BIGINT;
DECLARE @craftVendorUserId BIGINT;
DECLARE @craftVendorUserProfileId BIGINT;
DECLARE @craftVendorProfileId BIGINT;
DECLARE @foodCategoryId BIGINT;
DECLARE @craftCategoryId BIGINT;
DECLARE @currentEventId BIGINT;
DECLARE @secondCurrentEventId BIGINT;
DECLARE @historyEventId BIGINT;

BEGIN TRY
    BEGIN TRANSACTION;

    /* ---------- categories ---------- */
    IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE slug = N'food')
        INSERT INTO dbo.categories (name, slug, is_active)
        VALUES (N'餐飲美食', N'food', 1);
    ELSE
        UPDATE dbo.categories
        SET name = N'餐飲美食', is_active = 1
        WHERE slug = N'food';

    IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE slug = N'handmade')
        INSERT INTO dbo.categories (name, slug, is_active)
        VALUES (N'文創手作', N'handmade', 1);
    ELSE
        UPDATE dbo.categories
        SET name = N'文創手作', is_active = 1
        WHERE slug = N'handmade';

    IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE slug = N'family')
        INSERT INTO dbo.categories (name, slug, is_active)
        VALUES (N'親子家庭', N'family', 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE slug = N'pet-life')
        INSERT INTO dbo.categories (name, slug, is_active)
        VALUES (N'寵物生活', N'pet-life', 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE slug = N'plants')
        INSERT INTO dbo.categories (name, slug, is_active)
        VALUES (N'植物選物', N'plants', 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE slug = N'fashion-accessories')
        INSERT INTO dbo.categories (name, slug, is_active)
        VALUES (N'服飾配件', N'fashion-accessories', 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE slug = N'toys')
        INSERT INTO dbo.categories (name, slug, is_active)
        VALUES (N'玩具選物', N'toys', 1);

    SELECT @foodCategoryId = id FROM dbo.categories WHERE slug = N'food';
    SELECT @craftCategoryId = id FROM dbo.categories WHERE slug = N'handmade';

    /* ---------- accounts from .env.e2e.local ---------- */
    IF @e2eVendorEmail NOT LIKE '%@%'
       OR @e2eOrganizerEmail NOT LIKE '%@%'
       OR @e2eAdminEmail NOT LIKE '%@%'
       OR @e2eVendorPasswordHash NOT LIKE '$2%'
       OR @e2eOrganizerPasswordHash NOT LIKE '$2%'
       OR @e2eAdminPasswordHash NOT LIKE '$2%'
        THROW 51010, N'E2E account SQLCMD variables are missing or invalid. Use sql/run-e2e-seed.ps1.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = @e2eVendorEmail)
        INSERT INTO dbo.users (
            role, email, password_hash, provider, status,
            isLogin, email_verified_at, expired_time
        )
        VALUES (
            'VENDOR', @e2eVendorEmail, @e2eVendorPasswordHash, 'LOCAL', 'ACTIVE',
            0, @now, @now
        );
    ELSE
        UPDATE dbo.users
        SET role = 'VENDOR',
            password_hash = @e2eVendorPasswordHash,
            provider = 'LOCAL',
            google_sub = NULL,
            status = 'ACTIVE',
            isLogin = 0,
            email_verified_at = COALESCE(email_verified_at, @now),
            expired_time = @now,
            updated_at = @now
        WHERE email = @e2eVendorEmail;

    DECLARE @e2eVendorUserId BIGINT;
    DECLARE @e2eVendorUserProfileId BIGINT;
    SELECT @e2eVendorUserId = id FROM dbo.users WHERE email = @e2eVendorEmail;
    SELECT @e2eVendorUserProfileId = id
    FROM dbo.user_profiles
    WHERE user_id = @e2eVendorUserId AND profile_type = N'VENDOR';

    IF @e2eVendorUserProfileId IS NULL
    BEGIN
        INSERT INTO dbo.user_profiles (
            user_id, profile_type, contact_name, contact_phone,
            contact_email, city, district, address
        )
        VALUES (
            @e2eVendorUserId, N'VENDOR', N'市集攤主', N'0912111222',
            @e2eVendorEmail, N'台中市', N'西區', N'公益路100號'
        );
        SET @e2eVendorUserProfileId = SCOPE_IDENTITY();
    END
    ELSE
        UPDATE dbo.user_profiles
        SET contact_name = N'市集攤主',
            contact_phone = N'0912111222',
            contact_email = @e2eVendorEmail,
            city = N'台中市',
            district = N'西區',
            address = N'公益路100號'
        WHERE id = @e2eVendorUserProfileId;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.vendor_profiles
        WHERE user_profile_id = @e2eVendorUserProfileId
    )
        INSERT INTO dbo.vendor_profiles (
            user_profile_id, category_id, brand_name,
            avatar_image_url, cover_image_url,
            brand_summary, brand_description
        )
        VALUES (
            @e2eVendorUserProfileId, @craftCategoryId, N'山眠植作',
            N'/assets/images/user/brand/brands/brand-03/logo.png',
            N'/assets/images/user/brand/brands/brand-03/cover.png',
            N'以苔球、原木與自然素材創作療癒植栽。',
            N'希望把森林的安定感帶進日常生活。'
        );
    ELSE
        UPDATE dbo.vendor_profiles
        SET category_id = @craftCategoryId,
            brand_name = COALESCE(NULLIF(brand_name, N''), N'山眠植作'),
            avatar_image_url = COALESCE(
                avatar_image_url,
                N'/assets/images/user/brand/brands/brand-03/logo.png'
            ),
            cover_image_url = COALESCE(
                cover_image_url,
                N'/assets/images/user/brand/brands/brand-03/cover.png'
            ),
            brand_summary = COALESCE(
                NULLIF(brand_summary, N''),
                N'以苔球、原木與自然素材創作療癒植栽。'
            ),
            brand_description = COALESCE(
                NULLIF(brand_description, N''),
                N'希望把森林的安定感帶進日常生活。'
            )
        WHERE user_profile_id = @e2eVendorUserProfileId;

    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = @e2eOrganizerEmail)
        INSERT INTO dbo.users (
            role, email, password_hash, provider, status,
            isLogin, email_verified_at, expired_time
        )
        VALUES (
            'ORGANIZER', @e2eOrganizerEmail, @e2eOrganizerPasswordHash,
            'LOCAL', 'ACTIVE', 0, @now, @now
        );
    ELSE
        UPDATE dbo.users
        SET role = 'ORGANIZER',
            password_hash = @e2eOrganizerPasswordHash,
            provider = 'LOCAL',
            google_sub = NULL,
            status = 'ACTIVE',
            isLogin = 0,
            email_verified_at = COALESCE(email_verified_at, @now),
            expired_time = @now,
            updated_at = @now
        WHERE email = @e2eOrganizerEmail;

    DECLARE @e2eOrganizerUserId BIGINT;
    DECLARE @e2eOrganizerUserProfileId BIGINT;
    SELECT @e2eOrganizerUserId = id FROM dbo.users WHERE email = @e2eOrganizerEmail;
    SELECT @e2eOrganizerUserProfileId = id
    FROM dbo.user_profiles
    WHERE user_id = @e2eOrganizerUserId AND profile_type = N'ORGANIZER';

    IF @e2eOrganizerUserProfileId IS NULL
    BEGIN
        INSERT INTO dbo.user_profiles (
            user_id, profile_type, contact_name, contact_phone,
            contact_email, city, district, address
        )
        VALUES (
            @e2eOrganizerUserId, N'ORGANIZER', N'林沐晴', N'0928613745',
            @e2eOrganizerEmail, N'台北市', N'中正區', N'八德路一段1號'
        );
        SET @e2eOrganizerUserProfileId = SCOPE_IDENTITY();
    END
    ELSE
        UPDATE dbo.user_profiles
        SET contact_name = N'林沐晴',
            contact_phone = N'0928613745',
            contact_email = @e2eOrganizerEmail,
            city = N'台北市',
            district = N'中正區',
            address = N'八德路一段1號'
        WHERE id = @e2eOrganizerUserProfileId;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.organizer_profiles
        WHERE user_profile_id = @e2eOrganizerUserProfileId
    )
        INSERT INTO dbo.organizer_profiles (
            user_profile_id, organizer_name, company_name, tax_id,
            service_days, service_start_time, service_end_time
        )
        VALUES (
            @e2eOrganizerUserProfileId, N'沐日市集企劃工作室',
            N'沐日整合行銷有限公司', NULL,
            N'週一,週二,週三,週四,週五', '09:00', '18:00'
        );
    ELSE
        UPDATE dbo.organizer_profiles
        SET organizer_name = N'沐日市集企劃工作室',
            company_name = N'沐日整合行銷有限公司',
            service_days = N'週一,週二,週三,週四,週五',
            service_start_time = '09:00',
            service_end_time = '18:00'
        WHERE user_profile_id = @e2eOrganizerUserProfileId;

    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = @e2eAdminEmail)
        INSERT INTO dbo.users (
            role, email, password_hash, provider, status,
            isLogin, email_verified_at, expired_time
        )
        VALUES (
            'ADMIN', @e2eAdminEmail, @e2eAdminPasswordHash,
            'LOCAL', 'ACTIVE', 0, @now, @now
        );
    ELSE
        UPDATE dbo.users
        SET role = 'ADMIN',
            password_hash = @e2eAdminPasswordHash,
            provider = 'LOCAL',
            google_sub = NULL,
            status = 'ACTIVE',
            isLogin = 0,
            email_verified_at = COALESCE(email_verified_at, @now),
            expired_time = @now,
            updated_at = @now
        WHERE email = @e2eAdminEmail;

    DECLARE @e2eAdminUserId BIGINT;
    SELECT @e2eAdminUserId = id FROM dbo.users WHERE email = @e2eAdminEmail;

    IF NOT EXISTS (SELECT 1 FROM dbo.admin_profiles WHERE user_id = @e2eAdminUserId)
        INSERT INTO dbo.admin_profiles (user_id, admin_name)
        VALUES (@e2eAdminUserId, N'E2E 管理員');
    ELSE
        UPDATE dbo.admin_profiles
        SET admin_name = N'E2E 管理員'
        WHERE user_id = @e2eAdminUserId;

    /* ---------- remove prior public seed and organizer lifecycle artifacts ----------
       Reinsert the canonical seed on every run. Organizer event-management E2E
       creates cancelled events that are also returned by the history endpoint;
       remove only artifacts owned by the configured E2E organizer account. */
    DECLARE @resetEventIds TABLE (id BIGINT PRIMARY KEY);
    INSERT INTO @resetEventIds (id)
    SELECT id
    FROM dbo.market_events
    WHERE title IN (@currentTitle, @secondCurrentTitle, @historyTitle)
       OR (
           user_id = @e2eOrganizerUserId
           AND (
               title LIKE N'暖光生活市集・籌備草稿%'
               OR title LIKE N'巷弄好物生活節・週末限定場%'
           )
       );

    DELETE r
    FROM dbo.refunds r
    INNER JOIN dbo.event_applications ea ON ea.id = r.application_id
    INNER JOIN @resetEventIds target ON target.id = ea.event_id;

    DELETE p
    FROM dbo.payments p
    INNER JOIN dbo.event_applications ea ON ea.id = p.application_id
    INNER JOIN @resetEventIds target ON target.id = ea.event_id;

    DELETE er
    FROM dbo.equipment_rentals er
    INNER JOIN dbo.event_applications ea ON ea.id = er.application_id
    INNER JOIN @resetEventIds target ON target.id = ea.event_id;

    DELETE arn
    FROM dbo.application_review_notes arn
    INNER JOIN dbo.event_applications ea ON ea.id = arn.application_id
    INNER JOIN @resetEventIds target ON target.id = ea.event_id;

    DELETE ad
    FROM dbo.application_dates ad
    INNER JOIN dbo.event_applications ea ON ea.id = ad.application_id
    INNER JOIN @resetEventIds target ON target.id = ea.event_id;

    DELETE ea
    FROM dbo.event_applications ea
    INNER JOIN @resetEventIds target ON target.id = ea.event_id;

    DELETE es
    FROM dbo.event_stalls es
    INNER JOIN @resetEventIds target ON target.id = es.event_id;

    DELETE ez
    FROM dbo.event_stall_zones ez
    INNER JOIN @resetEventIds target ON target.id = ez.event_id;

    DELETE ee
    FROM dbo.event_equipments ee
    INNER JOIN @resetEventIds target ON target.id = ee.event_id;

    DELETE eur
    FROM dbo.event_unpublish_requests eur
    INNER JOIN @resetEventIds target ON target.id = eur.event_id;

    DELETE me
    FROM dbo.market_events me
    INNER JOIN @resetEventIds target ON target.id = me.id;

    /* ---------- organizer ---------- */
    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = @organizerEmail)
        INSERT INTO dbo.users (
            role, email, password_hash, provider, status,
            isLogin, email_verified_at, expired_time
        )
        VALUES (
            'ORGANIZER', @organizerEmail, NULL, 'LOCAL', 'ACTIVE',
            0, @now, @now
        );
    ELSE
        UPDATE dbo.users
        SET role = 'ORGANIZER',
            provider = 'LOCAL',
            google_sub = NULL,
            status = 'ACTIVE',
            email_verified_at = COALESCE(email_verified_at, @now),
            updated_at = @now
        WHERE email = @organizerEmail;

    SELECT @organizerUserId = id
    FROM dbo.users
    WHERE email = @organizerEmail;

    SELECT @organizerUserProfileId = id
    FROM dbo.user_profiles
    WHERE user_id = @organizerUserId
      AND profile_type = N'ORGANIZER';

    IF @organizerUserProfileId IS NULL
    BEGIN
        INSERT INTO dbo.user_profiles (
            user_id, profile_type, contact_name, contact_phone,
            contact_email, city, district, address
        )
        VALUES (
            @organizerUserId, N'ORGANIZER', N'林島日', N'04-23010001',
            @organizerEmail, N'台中市', N'西區', N'民生路368巷'
        );
        SET @organizerUserProfileId = SCOPE_IDENTITY();
    END
    ELSE
        UPDATE dbo.user_profiles
        SET contact_name = N'林島日',
            contact_phone = N'04-23010001',
            contact_email = @organizerEmail,
            city = N'台中市',
            district = N'西區',
            address = N'民生路368巷'
        WHERE id = @organizerUserProfileId;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.organizer_profiles
        WHERE user_profile_id = @organizerUserProfileId
    )
        INSERT INTO dbo.organizer_profiles (
            user_profile_id, organizer_name, company_name, tax_id,
            service_days, service_start_time, service_end_time
        )
        VALUES (
            @organizerUserProfileId, N'島嶼日和企劃',
            N'島嶼日和文化有限公司', N'24567891',
            N'週一至週五', '09:00', '18:00'
        );
    ELSE
        UPDATE dbo.organizer_profiles
        SET organizer_name = N'島嶼日和企劃',
            company_name = N'島嶼日和文化有限公司',
            tax_id = N'24567891',
            service_days = N'週一至週五',
            service_start_time = '09:00',
            service_end_time = '18:00'
        WHERE user_profile_id = @organizerUserProfileId;

    /* ---------- vendors ---------- */
    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = @foodVendorEmail)
        INSERT INTO dbo.users (
            role, email, password_hash, provider, status,
            isLogin, email_verified_at, expired_time
        )
        VALUES (
            'VENDOR', @foodVendorEmail, NULL, 'LOCAL', 'ACTIVE',
            0, @now, @now
        );
    ELSE
        UPDATE dbo.users
        SET role = 'VENDOR',
            provider = 'LOCAL',
            google_sub = NULL,
            status = 'ACTIVE',
            email_verified_at = COALESCE(email_verified_at, @now),
            updated_at = @now
        WHERE email = @foodVendorEmail;

    SELECT @foodVendorUserId = id
    FROM dbo.users
    WHERE email = @foodVendorEmail;

    SELECT @foodVendorUserProfileId = id
    FROM dbo.user_profiles
    WHERE user_id = @foodVendorUserId
      AND profile_type = N'VENDOR';

    IF @foodVendorUserProfileId IS NULL
    BEGIN
        INSERT INTO dbo.user_profiles (
            user_id, profile_type, contact_name, contact_phone,
            contact_email, city, district, address
        )
        VALUES (
            @foodVendorUserId, N'VENDOR', N'陳日光', N'0912000101',
            @foodVendorEmail, N'台中市', N'西區', N'公益路100號'
        );
        SET @foodVendorUserProfileId = SCOPE_IDENTITY();
    END

    IF NOT EXISTS (
        SELECT 1 FROM dbo.vendor_profiles
        WHERE user_profile_id = @foodVendorUserProfileId
    )
    BEGIN
        INSERT INTO dbo.vendor_profiles (
            user_profile_id, category_id, brand_name,
            avatar_image_url, cover_image_url,
            instagram_url, facebook_url, website_url,
            brand_summary, brand_description
        )
        VALUES (
            @foodVendorUserProfileId, @foodCategoryId, N'日光小廚房',
            N'/assets/images/user/brand/brands/brand-01/logo.png',
            N'/assets/images/user/brand/brands/brand-01/cover.png',
            N'https://www.instagram.com/sunlight.kitchen',
            N'https://www.facebook.com/sunlight.kitchen',
            N'https://sunlight-kitchen.example.com',
            N'以當季水果與清爽氣泡飲，為散步日常補上一點明亮風味。',
            N'日光小廚房選用在地食材製作飲品與點心，希望每一口都保留自然香氣。'
        );
        SET @foodVendorProfileId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        UPDATE dbo.vendor_profiles
        SET category_id = @foodCategoryId,
            brand_name = N'日光小廚房',
            avatar_image_url = N'/assets/images/user/brand/brands/brand-01/logo.png',
            cover_image_url = N'/assets/images/user/brand/brands/brand-01/cover.png',
            instagram_url = N'https://www.instagram.com/sunlight.kitchen',
            facebook_url = N'https://www.facebook.com/sunlight.kitchen',
            website_url = N'https://sunlight-kitchen.example.com',
            brand_summary = N'以當季水果與清爽氣泡飲，為散步日常補上一點明亮風味。',
            brand_description = N'日光小廚房選用在地食材製作飲品與點心，希望每一口都保留自然香氣。'
        WHERE user_profile_id = @foodVendorUserProfileId;
        SELECT @foodVendorProfileId = id
        FROM dbo.vendor_profiles
        WHERE user_profile_id = @foodVendorUserProfileId;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = @craftVendorEmail)
        INSERT INTO dbo.users (
            role, email, password_hash, provider, status,
            isLogin, email_verified_at, expired_time
        )
        VALUES (
            'VENDOR', @craftVendorEmail, NULL, 'LOCAL', 'ACTIVE',
            0, @now, @now
        );
    ELSE
        UPDATE dbo.users
        SET role = 'VENDOR',
            provider = 'LOCAL',
            google_sub = NULL,
            status = 'ACTIVE',
            email_verified_at = COALESCE(email_verified_at, @now),
            updated_at = @now
        WHERE email = @craftVendorEmail;

    SELECT @craftVendorUserId = id
    FROM dbo.users
    WHERE email = @craftVendorEmail;

    SELECT @craftVendorUserProfileId = id
    FROM dbo.user_profiles
    WHERE user_id = @craftVendorUserId
      AND profile_type = N'VENDOR';

    IF @craftVendorUserProfileId IS NULL
    BEGIN
        INSERT INTO dbo.user_profiles (
            user_id, profile_type, contact_name, contact_phone,
            contact_email, city, district, address
        )
        VALUES (
            @craftVendorUserId, N'VENDOR', N'林森日', N'0912000102',
            @craftVendorEmail, N'台中市', N'西區', N'向上路一段100號'
        );
        SET @craftVendorUserProfileId = SCOPE_IDENTITY();
    END

    IF NOT EXISTS (
        SELECT 1 FROM dbo.vendor_profiles
        WHERE user_profile_id = @craftVendorUserProfileId
    )
    BEGIN
        INSERT INTO dbo.vendor_profiles (
            user_profile_id, category_id, brand_name,
            avatar_image_url, cover_image_url,
            instagram_url, facebook_url, website_url,
            brand_summary, brand_description
        )
        VALUES (
            @craftVendorUserProfileId, @craftCategoryId, N'森日手作所',
            N'/assets/images/user/brand/brands/brand-02/logo.png',
            N'/assets/images/user/brand/brands/brand-02/cover.png',
            N'https://www.instagram.com/forest.craft',
            N'https://www.facebook.com/forest.craft',
            N'https://forest-craft.example.com',
            N'以木材與布料製作溫暖耐用的生活小物。',
            N'森日手作所從森林色彩取得靈感，專注於適合日常使用的手作器物。'
        );
        SET @craftVendorProfileId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        UPDATE dbo.vendor_profiles
        SET category_id = @craftCategoryId,
            brand_name = N'森日手作所',
            avatar_image_url = N'/assets/images/user/brand/brands/brand-02/logo.png',
            cover_image_url = N'/assets/images/user/brand/brands/brand-02/cover.png',
            instagram_url = N'https://www.instagram.com/forest.craft',
            facebook_url = N'https://www.facebook.com/forest.craft',
            website_url = N'https://forest-craft.example.com',
            brand_summary = N'以木材與布料製作溫暖耐用的生活小物。',
            brand_description = N'森日手作所從森林色彩取得靈感，專注於適合日常使用的手作器物。'
        WHERE user_profile_id = @craftVendorUserProfileId;
        SELECT @craftVendorProfileId = id
        FROM dbo.vendor_profiles
        WHERE user_profile_id = @craftVendorUserProfileId;
    END

    /* ---------- representative products ---------- */
    DELETE FROM dbo.vendor_products
    WHERE vendor_profile_id IN (@foodVendorProfileId, @craftVendorProfileId);

    INSERT INTO dbo.vendor_products (
        vendor_profile_id, name, short_description, description, price, image_url
    )
    VALUES
    (
        @foodVendorProfileId, N'蜂蜜檸檬氣泡飲',
        N'蜂蜜、檸檬與細緻氣泡的清爽組合。',
        N'使用新鮮檸檬汁與台灣蜂蜜調製。', 120,
        N'/assets/images/user/brand/brands/brand-01/product-01.png'
    ),
    (
        @foodVendorProfileId, N'季節果香磅蛋糕',
        N'依當季水果更換口味的常溫蛋糕。',
        N'適合搭配茶飲與咖啡。', 160,
        N'/assets/images/user/brand/brands/brand-01/product-02.png'
    ),
    (
        @craftVendorProfileId, N'原木桌上收納盤',
        N'保留自然木紋的手工收納盤。',
        N'每件作品的木紋皆不相同。', 480,
        N'/assets/images/user/brand/brands/brand-02/product-01.png'
    );

    /* ---------- canonical events ---------- */
    SELECT @currentEventId = id
    FROM dbo.market_events
    WHERE title = @currentTitle;

    IF @currentEventId IS NULL
    BEGIN
        INSERT INTO dbo.market_events (
            user_id, title, summary, description,
            location_name, city, district, address, notice,
            start_at, end_at, registration_start_at, registration_end_at,
            max_booths, stall_width, stall_length, base_fee, deposit_amount,
            traffic_info_metro, traffic_info_bus, traffic_info_driving,
            cover_image_url, map_image_url,
            public_info_at, brands_public_at, workflow_status
        )
        VALUES (
            @organizerUserId, @currentTitle,
            N'集結風格餐飲與手作選物的城市生活市集。',
            N'沿著審計新村散步，探索在地飲食、設計與適合全家參與的生活提案。',
            N'審計新村368新創聚落', N'台中市', N'西區', N'民生路368巷',
            N'請搭乘大眾運輸前往，並配合現場動線指引。',
            DATEADD(HOUR, 10, CAST(@today AS DATETIME2(0))),
            DATEADD(HOUR, 18, DATEADD(DAY, 1, CAST(@today AS DATETIME2(0)))),
            DATEADD(DAY, -14, CAST(@today AS DATETIME2(0))),
            DATEADD(HOUR, 9, CAST(@today AS DATETIME2(0))),
            50, 3, 3, 1800, 500,
            N'搭乘捷運至市政府站後轉乘公車。',
            N'搭乘 5、51、71 路公車至英才郵局站。',
            N'導航審計新村，周邊設有付費停車場。',
            N'/assets/images/market/cards/market-card-01.png',
            N'/assets/images/market/cards/market-card-01.png',
            DATEADD(DAY, -30, @now), DATEADD(MINUTE, -5, @now), N'PUBLISHED'
        );
        SET @currentEventId = SCOPE_IDENTITY();
    END
    ELSE
        UPDATE dbo.market_events
        SET user_id = @organizerUserId,
            summary = N'集結風格餐飲與手作選物的城市生活市集。',
            description = N'沿著審計新村散步，探索在地飲食、設計與適合全家參與的生活提案。',
            location_name = N'審計新村368新創聚落',
            city = N'台中市',
            district = N'西區',
            address = N'民生路368巷',
            notice = N'請搭乘大眾運輸前往，並配合現場動線指引。',
            start_at = DATEADD(HOUR, 10, CAST(@today AS DATETIME2(0))),
            end_at = DATEADD(HOUR, 18, DATEADD(DAY, 1, CAST(@today AS DATETIME2(0)))),
            registration_start_at = DATEADD(DAY, -14, CAST(@today AS DATETIME2(0))),
            registration_end_at = DATEADD(HOUR, 9, CAST(@today AS DATETIME2(0))),
            max_booths = 50,
            stall_width = 3,
            stall_length = 3,
            base_fee = 1800,
            deposit_amount = 500,
            traffic_info_metro = N'搭乘捷運至市政府站後轉乘公車。',
            traffic_info_bus = N'搭乘 5、51、71 路公車至英才郵局站。',
            traffic_info_driving = N'導航審計新村，周邊設有付費停車場。',
            cover_image_url = N'/assets/images/market/cards/market-card-01.png',
            map_image_url = N'/assets/images/market/cards/market-card-01.png',
            public_info_at = DATEADD(DAY, -30, @now),
            brands_public_at = DATEADD(MINUTE, -5, @now),
            workflow_status = N'PUBLISHED'
        WHERE id = @currentEventId;

    SELECT @secondCurrentEventId = id
    FROM dbo.market_events
    WHERE title = @secondCurrentTitle;

    IF @secondCurrentEventId IS NULL
    BEGIN
        INSERT INTO dbo.market_events (
            user_id, title, summary, description,
            location_name, city, district, address,
            start_at, end_at, registration_start_at, registration_end_at,
            max_booths, stall_width, stall_length, base_fee, deposit_amount,
            traffic_info_metro, traffic_info_bus, traffic_info_driving,
            cover_image_url, public_info_at, brands_public_at, workflow_status
        )
        VALUES (
            @organizerUserId, @secondCurrentTitle,
            N'適合午後散步的風格選物與餐飲聚會。',
            N'由在地品牌共同策劃，分享季節風味與手作生活。',
            N'審計新村368新創聚落', N'台中市', N'西區', N'民生路368巷',
            DATEADD(HOUR, 11, CAST(@today AS DATETIME2(0))),
            DATEADD(HOUR, 17, DATEADD(DAY, 1, CAST(@today AS DATETIME2(0)))),
            DATEADD(DAY, -10, CAST(@today AS DATETIME2(0))),
            DATEADD(HOUR, 9, CAST(@today AS DATETIME2(0))),
            20, 3, 3, 1200, 300,
            N'可由市政府站轉乘公車。',
            N'英才郵局站下車步行約五分鐘。',
            N'建議使用周邊付費停車場。',
            N'/assets/images/market/cards/market-card-02.png',
            DATEADD(DAY, -20, @now), DATEADD(MINUTE, -5, @now), N'PUBLISHED'
        );
        SET @secondCurrentEventId = SCOPE_IDENTITY();
    END
    ELSE
        UPDATE dbo.market_events
        SET user_id = @organizerUserId,
            summary = N'適合午後散步的風格選物與餐飲聚會。',
            description = N'由在地品牌共同策劃，分享季節風味與手作生活。',
            location_name = N'審計新村368新創聚落',
            city = N'台中市',
            district = N'西區',
            address = N'民生路368巷',
            start_at = DATEADD(HOUR, 11, CAST(@today AS DATETIME2(0))),
            end_at = DATEADD(HOUR, 17, DATEADD(DAY, 1, CAST(@today AS DATETIME2(0)))),
            registration_start_at = DATEADD(DAY, -10, CAST(@today AS DATETIME2(0))),
            registration_end_at = DATEADD(HOUR, 9, CAST(@today AS DATETIME2(0))),
            max_booths = 20,
            stall_width = 3,
            stall_length = 3,
            base_fee = 1200,
            deposit_amount = 300,
            traffic_info_metro = N'可由市政府站轉乘公車。',
            traffic_info_bus = N'英才郵局站下車步行約五分鐘。',
            traffic_info_driving = N'建議使用周邊付費停車場。',
            cover_image_url = N'/assets/images/market/cards/market-card-02.png',
            public_info_at = DATEADD(DAY, -20, @now),
            brands_public_at = DATEADD(MINUTE, -5, @now),
            workflow_status = N'PUBLISHED'
        WHERE id = @secondCurrentEventId;

    SELECT @historyEventId = id
    FROM dbo.market_events
    WHERE title = @historyTitle;

    IF @historyEventId IS NULL
    BEGIN
        INSERT INTO dbo.market_events (
            user_id, title, summary, description,
            location_name, city, district, address,
            start_at, end_at, registration_start_at, registration_end_at,
            max_booths, stall_width, stall_length, base_fee, deposit_amount,
            traffic_info_metro, traffic_info_bus, traffic_info_driving,
            cover_image_url, public_info_at, brands_public_at, workflow_status
        )
        VALUES (
            @organizerUserId, @historyTitle,
            N'在草地與春光中相遇的野餐生活市集。',
            N'回顧春季限定的餐飲、手作與親子體驗。',
            N'審計新村368新創聚落', N'台中市', N'西區', N'民生路368巷',
            DATEADD(HOUR, 10, DATEADD(DAY, -35, CAST(@today AS DATETIME2(0)))),
            DATEADD(HOUR, 18, DATEADD(DAY, -34, CAST(@today AS DATETIME2(0)))),
            DATEADD(DAY, -70, CAST(@today AS DATETIME2(0))),
            DATEADD(DAY, -40, CAST(@today AS DATETIME2(0))),
            50, 3, 3, 1500, 500,
            N'搭乘大眾運輸至審計新村。',
            N'英才郵局站下車步行約五分鐘。',
            N'周邊設有付費停車場。',
            N'/assets/images/market/history/history-market-01.png',
            DATEADD(DAY, -70, @now), DATEADD(DAY, -40, @now), N'PUBLISHED'
        );
        SET @historyEventId = SCOPE_IDENTITY();
    END
    ELSE
        UPDATE dbo.market_events
        SET user_id = @organizerUserId,
            summary = N'在草地與春光中相遇的野餐生活市集。',
            description = N'回顧春季限定的餐飲、手作與親子體驗。',
            location_name = N'審計新村368新創聚落',
            city = N'台中市',
            district = N'西區',
            address = N'民生路368巷',
            start_at = DATEADD(HOUR, 10, DATEADD(DAY, -35, CAST(@today AS DATETIME2(0)))),
            end_at = DATEADD(HOUR, 18, DATEADD(DAY, -34, CAST(@today AS DATETIME2(0)))),
            registration_start_at = DATEADD(DAY, -70, CAST(@today AS DATETIME2(0))),
            registration_end_at = DATEADD(DAY, -40, CAST(@today AS DATETIME2(0))),
            max_booths = 50,
            stall_width = 3,
            stall_length = 3,
            base_fee = 1500,
            deposit_amount = 500,
            traffic_info_metro = N'搭乘大眾運輸至審計新村。',
            traffic_info_bus = N'英才郵局站下車步行約五分鐘。',
            traffic_info_driving = N'周邊設有付費停車場。',
            cover_image_url = N'/assets/images/market/history/history-market-01.png',
            public_info_at = DATEADD(DAY, -70, @now),
            brands_public_at = DATEADD(DAY, -40, @now),
            workflow_status = N'PUBLISHED'
        WHERE id = @historyEventId;

    /* ---------- event categories ---------- */
    DELETE FROM dbo.market_event_categories
    WHERE event_id IN (@currentEventId, @secondCurrentEventId, @historyEventId);

    INSERT INTO dbo.market_event_categories (event_id, category_id)
    VALUES
        (@currentEventId, @foodCategoryId),
        (@currentEventId, @craftCategoryId),
        (@secondCurrentEventId, @foodCategoryId),
        (@historyEventId, @foodCategoryId),
        (@historyEventId, @craftCategoryId);

    /* ---------- main-event applications and map ---------- */
    DELETE ad
    FROM dbo.application_dates ad
    INNER JOIN dbo.event_applications ea ON ea.id = ad.application_id
    WHERE ea.application_no LIKE N'PUB-MAIN-STALL-%'
       OR ea.application_no IN (
           N'PUB-MAIN-FOOD', N'PUB-MAIN-CRAFT',
           N'PUB-HISTORY-FOOD', N'PUB-HISTORY-CRAFT'
       );

    DELETE FROM dbo.event_applications
    WHERE application_no LIKE N'PUB-MAIN-STALL-%'
       OR application_no IN (
           N'PUB-MAIN-FOOD', N'PUB-MAIN-CRAFT',
           N'PUB-HISTORY-FOOD', N'PUB-HISTORY-CRAFT'
       );

    DELETE FROM dbo.event_stalls WHERE event_id = @currentEventId;
    DELETE FROM dbo.event_stall_zones WHERE event_id = @currentEventId;

    DECLARE @zoneAId BIGINT;
    DECLARE @zoneBId BIGINT;
    DECLARE @zoneCId BIGINT;

    INSERT INTO dbo.event_stall_zones (event_id, zone_name, zone_color, stall_count)
    VALUES (@currentEventId, N'A 區', N'#F97316', 28);
    SET @zoneAId = SCOPE_IDENTITY();

    INSERT INTO dbo.event_stall_zones (event_id, zone_name, zone_color, stall_count)
    VALUES (@currentEventId, N'B 區', N'#0EA5E9', 13);
    SET @zoneBId = SCOPE_IDENTITY();

    INSERT INTO dbo.event_stall_zones (event_id, zone_name, zone_color, stall_count)
    VALUES (@currentEventId, N'C 區', N'#22C55E', 9);
    SET @zoneCId = SCOPE_IDENTITY();

    DECLARE @stallIndex INT = 1;
    WHILE @stallIndex <= 28
    BEGIN
        INSERT INTO dbo.event_stalls (event_id, zone_id, stall_no, status)
        VALUES (
            @currentEventId, @zoneAId,
            N'A' + RIGHT(N'0' + CAST(@stallIndex AS NVARCHAR(2)), 2),
            N'ASSIGNED'
        );
        SET @stallIndex += 1;
    END

    SET @stallIndex = 1;
    WHILE @stallIndex <= 13
    BEGIN
        INSERT INTO dbo.event_stalls (event_id, zone_id, stall_no, status)
        VALUES (
            @currentEventId, @zoneBId,
            N'B' + RIGHT(N'0' + CAST(@stallIndex AS NVARCHAR(2)), 2),
            N'ASSIGNED'
        );
        SET @stallIndex += 1;
    END

    SET @stallIndex = 1;
    WHILE @stallIndex <= 9
    BEGIN
        INSERT INTO dbo.event_stalls (event_id, zone_id, stall_no, status)
        VALUES (
            @currentEventId, @zoneCId,
            N'C' + RIGHT(N'0' + CAST(@stallIndex AS NVARCHAR(2)), 2),
            N'ASSIGNED'
        );
        SET @stallIndex += 1;
    END

    INSERT INTO dbo.event_applications (
        application_no, event_id, user_id, vendor_profile_id,
        total_amount, deposit_amount, deposit_status,
        payment_due_at, review_status, payment_status, is_cancelled
    )
    VALUES
    (
        N'PUB-HISTORY-FOOD', @historyEventId, @foodVendorUserId, @foodVendorProfileId,
        2000, 500, N'RETURNED',
        DATEADD(DAY, -50, @now), N'APPROVED', N'PAID', 0
    ),
    (
        N'PUB-HISTORY-CRAFT', @historyEventId, @craftVendorUserId, @craftVendorProfileId,
        2000, 500, N'RETURNED',
        DATEADD(DAY, -50, @now), N'APPROVED', N'PAID', 0
    );

    DECLARE @historyFoodApplicationId BIGINT;
    DECLARE @historyCraftApplicationId BIGINT;

    SELECT @historyFoodApplicationId = id
    FROM dbo.event_applications WHERE application_no = N'PUB-HISTORY-FOOD';
    SELECT @historyCraftApplicationId = id
    FROM dbo.event_applications WHERE application_no = N'PUB-HISTORY-CRAFT';

    INSERT INTO dbo.application_dates (application_id, apply_date, selected_stall_id)
    VALUES
        (@historyFoodApplicationId, DATEADD(DAY, -35, @today), NULL),
        (@historyCraftApplicationId, DATEADD(DAY, -35, @today), NULL);

    /* Every public stall has one active vendor application.
       A09 and B02 keep the two canonical brands used by E2E assertions.
       The remaining stalls use distinct, realistic simulated brands. */
    DECLARE @publicBrandSeeds TABLE (
        stall_no NVARCHAR(20) PRIMARY KEY,
        brand_name NVARCHAR(100) NOT NULL,
        category_slug NVARCHAR(50) NOT NULL,
        brand_summary NVARCHAR(500) NOT NULL,
        image_index INT NOT NULL
    );

    INSERT INTO @publicBrandSeeds (
        stall_no, brand_name, category_slug, brand_summary, image_index
    )
    VALUES
        (N'A01', N'暮光烘焙所', N'food', N'每日少量現烤酸種麵包與奶油可頌，使用台灣小麥與當季果乾。', 1),
        (N'A02', N'棉花雨手作', N'handmade', N'以柔和配色製作刺繡別針、布包與日常小物，每件作品皆為手工縫製。', 2),
        (N'A03', N'山丘果醬房', N'food', N'選用小農水果慢火熬煮低糖果醬，保留果肉與四季自然風味。', 3),
        (N'A04', N'拾光陶作', N'handmade', N'製作適合每日使用的手捏陶杯、餐盤與花器，呈現溫潤土質肌理。', 4),
        (N'A05', N'好日咖啡研究室', N'food', N'自家烘焙單品咖啡與手沖配方，帶來乾淨明亮的日常咖啡體驗。', 5),
        (N'A06', N'小森皮件', N'fashion-accessories', N'以植鞣皮革手工製作卡套、零錢包與鑰匙圈，讓皮件陪伴生活變化。', 6),
        (N'A07', N'島嶼茶席', N'food', N'嚴選台灣山茶與季節冷泡茶，在市集分享清爽細緻的茶香。', 7),
        (N'A08', N'微光銀飾', N'fashion-accessories', N'以純銀與天然石打造簡約耳飾、戒指及項鍊，適合每日自由搭配。', 8),
        (N'A09', N'日光小廚房', N'food', N'以當季水果與清爽食材製作輕食甜點，為散步日常補上一點明亮風味。', 1),
        (N'A10', N'木木器物', N'handmade', N'選用天然木材製作托盤、餐具與桌上器物，保留每塊木頭獨有紋理。', 2),
        (N'A11', N'一匙甜點', N'food', N'專注滑順布丁、奶酪與杯裝甜點，以不過度甜膩的配方呈現食材原味。', 3),
        (N'A12', N'線條刺繡所', N'handmade', N'把植物與城市風景繡進布章、掛畫及隨身小物，收藏細緻生活片段。', 4),
        (N'A13', N'海風鹹派', N'food', N'使用新鮮蔬菜與自製酥皮烘烤法式鹹派，提供適合散步享用的輕食。', 5),
        (N'A14', N'日日布作', N'fashion-accessories', N'以耐用棉麻布料製作托特包、帽款與收納袋，兼顧簡潔外型與實用性。', 6),
        (N'A15', N'麥香貝果社', N'food', N'長時間低溫發酵的手工貝果，搭配台灣茶、堅果與季節限定口味。', 7),
        (N'A16', N'森林紙品室', N'handmade', N'以原創插畫設計明信片、紙膠帶與手帳素材，記錄旅途和日常心情。', 8),
        (N'A17', N'花時間司康', N'food', N'每日現烤英式司康，搭配自製果醬與奶油，口味隨季節更新。', 1),
        (N'A18', N'小路編織', N'fashion-accessories', N'使用天然棉線編織帽子、隨身袋與杯墊，打造輕盈耐用的生活配件。', 2),
        (N'A19', N'慢慢發酵', N'food', N'以天然酵母與長時間發酵製作歐式麵包，呈現穀物香氣與紮實口感。', 3),
        (N'A20', N'暖木玩具房', N'toys', N'設計安全耐玩的木製積木與益智玩具，陪孩子在遊戲中自由探索。', 4),
        (N'A21', N'角落可麗露', N'food', N'專門烘烤外脆內軟的可麗露，推出香草、焙茶與季節水果口味。', 5),
        (N'A22', N'青苔植作', N'plants', N'挑選適合室內照顧的小型植栽與苔球，提供新手友善的養護說明。', 6),
        (N'A23', N'白日夢糖果店', N'food', N'手工熬煮水果軟糖與牛奶糖，以天然香氣做出大人也喜歡的甜味。', 7),
        (N'A24', N'手心玻璃屋', N'handmade', N'運用玻璃燒製耳飾、胸針與窗邊吊飾，讓光線成為作品的一部分。', 8),
        (N'A25', N'野餐三明治', N'food', N'將當季蔬菜、自製醬料與厚切麵包組合成方便帶著走的野餐輕食。', 1),
        (N'A26', N'貓日子雜貨', N'pet-life', N'為貓咪與飼主設計耐用玩具、領巾及生活雜貨，重視安全材質與清潔便利。', 2),
        (N'A27', N'雨林氣泡室', N'food', N'使用新鮮水果、香草與自製糖漿調製氣泡飲，清爽呈現季節香氣。', 3),
        (N'A28', N'一隅香氛', N'handmade', N'小批次調製大豆蠟燭與擴香，從植物、木質與茶香尋找安定氣味。', 4),
        (N'B01', N'晨光飯糰', N'food', N'以台灣米和家常配菜現場製作飯糰，提供簡單飽足的市集早餐。', 5),
        (N'B02', N'森日手作所', N'handmade', N'以木材與布料製作溫暖耐用的生活小物，讓手作自然融入每一天。', 6),
        (N'B03', N'小島漬物', N'food', N'以旬味蔬果製作淺漬、泡菜與下飯小菜，保留爽脆口感與自然酸香。', 7),
        (N'B04', N'茶山編織', N'fashion-accessories', N'融合山林色彩與手工編織技法，製作日常提袋、帽飾與隨身配件。', 8),
        (N'B05', N'鹿角甜室', N'food', N'提供巴斯克蛋糕、磅蛋糕與季節塔點，使用單純原料呈現細緻甜味。', 1),
        (N'B06', N'植日花房', N'plants', N'設計小型盆花、乾燥花束與桌上植栽，把四季植物帶進生活空間。', 2),
        (N'B07', N'午後奶酪', N'food', N'以鮮乳製作滑嫩奶酪與優格杯，搭配自熬果醬和當季水果。', 3),
        (N'B08', N'毛球點心舖', N'pet-life', N'使用成分單純的食材烘製寵物點心，依不同體型提供合適份量與硬度。', 4),
        (N'B09', N'拾穗咖啡', N'food', N'精選不同產區咖啡豆現場手沖，也提供方便在家沖煮的濾掛組合。', 5),
        (N'B10', N'玩木小隊', N'toys', N'以木頭設計拼圖、平衡遊戲與親子共玩教具，鼓勵孩子動手思考。', 6),
        (N'B11', N'漫步衣櫥', N'fashion-accessories', N'精選舒適自然材質的日常服裝與配件，提供輕鬆好搭的穿著提案。', 7),
        (N'B12', N'果實冰茶', N'food', N'將台灣茶與新鮮果物冷泡調和，提供低糖、清爽且有層次的冰茶。', 8),
        (N'B13', N'親子共讀屋', N'family', N'精選圖畫書、故事卡與親子互動教材，讓閱讀成為家庭自在相處的時光。', 1),
        (N'C01', N'南風咖哩', N'food', N'以多種香料慢炒熬煮溫和咖哩，搭配當季蔬菜與台灣米飯。', 2),
        (N'C02', N'蕨醒植栽', N'plants', N'專注蕨類、觀葉植物與再生盆器，提供適合居家環境的照護建議。', 3),
        (N'C03', N'小犬生活製作所', N'pet-life', N'為犬隻設計胸背帶、牽繩與外出用品，兼顧活動舒適度及耐用性。', 4),
        (N'C04', N'米香研究所', N'food', N'使用台灣稻米製作米餅、米香與無麩質點心，探索米食的多種口感。', 5),
        (N'C05', N'星球積木社', N'toys', N'提供開放式積木與桌上遊戲，讓孩子用想像力建造自己的小小世界。', 6),
        (N'C06', N'童話布偶室', N'family', N'手工縫製布偶、安撫巾與故事角色，使用親膚布料陪伴孩子成長。', 7),
        (N'C07', N'山系帽作', N'fashion-accessories', N'製作適合旅行與戶外散步的帽款和小包，重視透氣、耐用與收納便利。', 8),
        (N'C08', N'木漏日花藝', N'plants', N'以鮮花、乾燥植物與自然素材製作花束，收藏陽光穿過枝葉的片刻。', 1),
        (N'C09', N'月見糰子舖', N'food', N'每日手作糰子與米點心，搭配焙茶、芝麻和季節限定風味。', 2);

    IF (SELECT COUNT(*) FROM @publicBrandSeeds) <> 50
       OR (SELECT COUNT(DISTINCT brand_name) FROM @publicBrandSeeds) <> 50
        THROW 51112, N'Public brand seed must contain 50 distinct brands.', 1;

    DECLARE @publicStalls TABLE (
        row_no INT IDENTITY(1,1) PRIMARY KEY,
        stall_id BIGINT NOT NULL,
        stall_no NVARCHAR(20) NOT NULL
    );

    INSERT INTO @publicStalls (stall_id, stall_no)
    SELECT id, stall_no
    FROM dbo.event_stalls
    WHERE event_id = @currentEventId
    ORDER BY stall_no;

    DECLARE @publicStallRow INT = 1;
    DECLARE @publicStallTotal INT = (SELECT COUNT(*) FROM @publicStalls);
    DECLARE @publicStallId BIGINT;
    DECLARE @publicStallNo NVARCHAR(20);
    DECLARE @publicVendorEmail VARCHAR(255);
    DECLARE @publicVendorUserId BIGINT;
    DECLARE @publicVendorUserProfileId BIGINT;
    DECLARE @publicVendorProfileId BIGINT;
    DECLARE @publicCategoryId BIGINT;
    DECLARE @publicBrandName NVARCHAR(100);
    DECLARE @publicCategorySlug NVARCHAR(50);
    DECLARE @publicBrandSummary NVARCHAR(500);
    DECLARE @publicBrandDescription NVARCHAR(MAX);
    DECLARE @publicApplicationId BIGINT;
    DECLARE @publicApplicationNo NVARCHAR(30);
    DECLARE @publicImageIndex INT;
    DECLARE @publicImageFolder NVARCHAR(20);

    WHILE @publicStallRow <= @publicStallTotal
    BEGIN
        SELECT
            @publicStallId = stall_id,
            @publicStallNo = stall_no
        FROM @publicStalls
        WHERE row_no = @publicStallRow;

        SET @publicVendorUserId = NULL;
        SET @publicVendorUserProfileId = NULL;
        SET @publicVendorProfileId = NULL;
        SET @publicApplicationId = NULL;
        SET @publicCategoryId = NULL;
        SET @publicBrandName = NULL;
        SET @publicCategorySlug = NULL;
        SET @publicBrandSummary = NULL;
        SET @publicBrandDescription = NULL;
        SET @publicImageIndex = NULL;
        SET @publicApplicationNo = N'PUB-MAIN-STALL-' + @publicStallNo;

        IF @publicStallNo = N'A09'
        BEGIN
            SET @publicVendorUserId = @foodVendorUserId;
            SET @publicVendorProfileId = @foodVendorProfileId;
        END
        ELSE IF @publicStallNo = N'B02'
        BEGIN
            SET @publicVendorUserId = @craftVendorUserId;
            SET @publicVendorProfileId = @craftVendorProfileId;
        END
        ELSE
        BEGIN
            SET @publicVendorEmail =
                'public.stall.' + LOWER(CONVERT(VARCHAR(20), @publicStallNo))
                + '@marketday.local';
            SELECT
                @publicBrandName = brand_name,
                @publicCategorySlug = category_slug,
                @publicBrandSummary = brand_summary,
                @publicImageIndex = image_index
            FROM @publicBrandSeeds
            WHERE stall_no = @publicStallNo;

            SELECT @publicCategoryId = id
            FROM dbo.categories
            WHERE slug = @publicCategorySlug;

            SET @publicBrandDescription =
                @publicBrandSummary
                + N' 品牌從選材、製作到包裝皆親自把關，希望透過市集與大家分享作品背後的日常故事。';
            SET @publicImageFolder =
                N'brand-' + RIGHT(N'0' + CAST(@publicImageIndex AS NVARCHAR(2)), 2);

            IF @publicBrandName IS NULL OR @publicCategoryId IS NULL
                THROW 51111, N'Public stall brand seed is missing or has an invalid category.', 1;

            IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = @publicVendorEmail)
                INSERT INTO dbo.users (
                    role, email, password_hash, provider, status,
                    isLogin, email_verified_at, expired_time
                )
                VALUES (
                    'VENDOR', @publicVendorEmail, NULL, 'LOCAL', 'ACTIVE',
                    0, @now, @now
                );
            ELSE
                UPDATE dbo.users
                SET role = 'VENDOR',
                    provider = 'LOCAL',
                    status = 'ACTIVE',
                    email_verified_at = COALESCE(email_verified_at, @now),
                    updated_at = @now
                WHERE email = @publicVendorEmail;

            SELECT @publicVendorUserId = id
            FROM dbo.users
            WHERE email = @publicVendorEmail;

            SELECT @publicVendorUserProfileId = id
            FROM dbo.user_profiles
            WHERE user_id = @publicVendorUserId
              AND profile_type = N'VENDOR';

            IF @publicVendorUserProfileId IS NULL
            BEGIN
                INSERT INTO dbo.user_profiles (
                    user_id, profile_type, contact_name, contact_phone,
                    contact_email, city, district, address
                )
                VALUES (
                    @publicVendorUserId, N'VENDOR',
                    @publicBrandName + N' 負責人',
                    N'0912' + RIGHT(N'000000' + CAST(@publicStallRow AS NVARCHAR(6)), 6),
                    @publicVendorEmail, N'台中市', N'西區', N'民生路368巷'
                );
                SET @publicVendorUserProfileId = SCOPE_IDENTITY();
            END
            ELSE
                UPDATE dbo.user_profiles
                SET contact_name = @publicBrandName + N' 負責人',
                    contact_phone =
                        N'0912' + RIGHT(N'000000' + CAST(@publicStallRow AS NVARCHAR(6)), 6),
                    contact_email = @publicVendorEmail,
                    city = N'台中市',
                    district = N'西區',
                    address = N'民生路368巷'
                WHERE id = @publicVendorUserProfileId;

            SELECT @publicVendorProfileId = id
            FROM dbo.vendor_profiles
            WHERE user_profile_id = @publicVendorUserProfileId;

            IF @publicVendorProfileId IS NULL
            BEGIN
                INSERT INTO dbo.vendor_profiles (
                    user_profile_id, category_id, brand_name,
                    avatar_image_url, cover_image_url,
                    instagram_url, facebook_url, website_url,
                    brand_summary, brand_description
                )
                VALUES (
                    @publicVendorUserProfileId, @publicCategoryId, @publicBrandName,
                    N'/assets/images/user/brand/brands/' + @publicImageFolder + N'/logo.png',
                    N'/assets/images/user/brand/brands/' + @publicImageFolder + N'/cover.png',
                    N'https://www.instagram.com/marketday.seed',
                    N'https://www.facebook.com/marketday.seed',
                    N'https://marketday.example.com',
                    @publicBrandSummary,
                    @publicBrandDescription
                );
                SET @publicVendorProfileId = SCOPE_IDENTITY();
            END
            ELSE
                UPDATE dbo.vendor_profiles
                SET category_id = @publicCategoryId,
                    brand_name = @publicBrandName,
                    avatar_image_url =
                        N'/assets/images/user/brand/brands/' + @publicImageFolder + N'/logo.png',
                    cover_image_url =
                        N'/assets/images/user/brand/brands/' + @publicImageFolder + N'/cover.png',
                    instagram_url = N'https://www.instagram.com/marketday.seed',
                    facebook_url = N'https://www.facebook.com/marketday.seed',
                    website_url = N'https://marketday.example.com',
                    brand_summary = @publicBrandSummary,
                    brand_description = @publicBrandDescription
                WHERE id = @publicVendorProfileId;
        END

        INSERT INTO dbo.event_applications (
            application_no, event_id, user_id, vendor_profile_id,
            total_amount, deposit_amount, deposit_status,
            payment_due_at, review_status, payment_status, is_cancelled
        )
        VALUES (
            @publicApplicationNo, @currentEventId,
            @publicVendorUserId, @publicVendorProfileId,
            2300, 500, N'NOT_RETURNED',
            DATEADD(DAY, -3, @now), N'APPROVED', N'PAID', 0
        );
        SET @publicApplicationId = SCOPE_IDENTITY();

        INSERT INTO dbo.application_dates (
            application_id, apply_date, selected_stall_id
        )
        VALUES
            (@publicApplicationId, @today, @publicStallId),
            (@publicApplicationId, DATEADD(DAY, 1, @today), @publicStallId);

        SET @publicStallRow += 1;
    END

    /* ---------- exact E2E contract validation ---------- */
    IF (SELECT COUNT(*) FROM dbo.market_events WHERE title = @currentTitle) <> 1
        THROW 51101, N'Expected exactly one 島嶼日和生活市集.', 1;

    IF (SELECT COUNT(*) FROM dbo.market_events WHERE title = @historyTitle) <> 1
        THROW 51102, N'Expected exactly one 春日野餐市集.', 1;

    IF (SELECT COUNT(*) FROM dbo.vendor_profiles WHERE brand_name = N'日光小廚房') <> 1
        THROW 51103, N'Expected exactly one 日光小廚房.', 1;

    IF (SELECT COUNT(*) FROM dbo.vendor_profiles WHERE brand_name = N'森日手作所') <> 1
        THROW 51104, N'Expected exactly one 森日手作所.', 1;

    IF EXISTS (
        SELECT 1
        FROM dbo.market_events
        WHERE id IN (@currentEventId, @historyEventId)
          AND (
              location_name <> N'審計新村368新創聚落'
              OR city <> N'台中市'
              OR district <> N'西區'
              OR address <> N'民生路368巷'
          )
    )
        THROW 51105, N'Public market location exact-match validation failed.', 1;

    IF (SELECT COUNT(*) FROM dbo.event_stalls WHERE event_id = @currentEventId) <> 50
        THROW 51106, N'島嶼日和生活市集 must contain exactly 50 stalls.', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.application_dates ad
        INNER JOIN dbo.event_applications ea ON ea.id = ad.application_id
        INNER JOIN dbo.event_stalls s ON s.id = ad.selected_stall_id
        INNER JOIN dbo.vendor_profiles vp ON vp.id = ea.vendor_profile_id
        WHERE ea.event_id = @currentEventId
          AND ad.apply_date = @today
          AND s.stall_no = N'A09'
          AND vp.brand_name = N'日光小廚房'
    )
        THROW 51107, N'A09 must resolve to 日光小廚房.', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.application_dates ad
        INNER JOIN dbo.event_applications ea ON ea.id = ad.application_id
        INNER JOIN dbo.event_stalls s ON s.id = ad.selected_stall_id
        INNER JOIN dbo.vendor_profiles vp ON vp.id = ea.vendor_profile_id
        WHERE ea.event_id = @currentEventId
          AND ad.apply_date = @today
          AND s.stall_no = N'B02'
          AND vp.brand_name = N'森日手作所'
    )
        THROW 51108, N'B02 must resolve to 森日手作所.', 1;

    IF (
        SELECT COUNT(*)
        FROM dbo.application_dates ad
        INNER JOIN dbo.event_applications ea ON ea.id = ad.application_id
        INNER JOIN dbo.event_stalls s ON s.id = ad.selected_stall_id
        INNER JOIN dbo.vendor_profiles vp ON vp.id = ea.vendor_profile_id
        WHERE ea.event_id = @currentEventId
          AND ea.review_status = N'APPROVED'
          AND ea.payment_status = N'PAID'
          AND ea.is_cancelled = 0
          AND ad.apply_date = @today
          AND NULLIF(vp.brand_name, N'') IS NOT NULL
    ) <> 50
        THROW 51109, N'Current event must expose 50 stall brands for the first day.', 1;

    IF (
        SELECT COUNT(*)
        FROM dbo.application_dates ad
        INNER JOIN dbo.event_applications ea ON ea.id = ad.application_id
        INNER JOIN dbo.event_stalls s ON s.id = ad.selected_stall_id
        INNER JOIN dbo.vendor_profiles vp ON vp.id = ea.vendor_profile_id
        WHERE ea.event_id = @currentEventId
          AND ea.review_status = N'APPROVED'
          AND ea.payment_status = N'PAID'
          AND ea.is_cancelled = 0
          AND ad.apply_date = DATEADD(DAY, 1, @today)
          AND NULLIF(vp.brand_name, N'') IS NOT NULL
    ) <> 50
        THROW 51110, N'Current event must expose 50 stall brands for the second day.', 1;

    IF (
        SELECT COUNT(DISTINCT vp.brand_name)
        FROM dbo.application_dates ad
        INNER JOIN dbo.event_applications ea ON ea.id = ad.application_id
        INNER JOIN dbo.vendor_profiles vp ON vp.id = ea.vendor_profile_id
        WHERE ea.event_id = @currentEventId
          AND ea.review_status = N'APPROVED'
          AND ea.payment_status = N'PAID'
          AND ea.is_cancelled = 0
          AND ad.apply_date = @today
    ) <> 50
        THROW 51113, N'Current event must expose 50 distinct stall brands.', 1;

    IF EXISTS (
        SELECT 1
        FROM dbo.application_dates ad
        INNER JOIN dbo.event_applications ea ON ea.id = ad.application_id
        INNER JOIN dbo.vendor_profiles vp ON vp.id = ea.vendor_profile_id
        WHERE ea.event_id = @currentEventId
          AND ad.apply_date = @today
          AND (
              vp.brand_name LIKE N'島嶼食光 %'
              OR vp.brand_name LIKE N'島嶼手作 %'
          )
    )
        THROW 51114, N'Placeholder public brand names are not allowed.', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

SELECT
    e.id,
    e.title,
    e.city,
    e.district,
    e.location_name AS locationName,
    CAST(e.start_at AS DATE) AS startDate,
    CAST(e.end_at AS DATE) AS endDate,
    e.workflow_status AS workflowStatus,
    COUNT(s.id) AS stallCount
FROM dbo.market_events e
LEFT JOIN dbo.event_stalls s ON s.event_id = e.id
WHERE e.title IN (
    N'島嶼日和生活市集',
    N'城市微光散步市集',
    N'春日野餐市集'
)
GROUP BY
    e.id, e.title, e.city, e.district, e.location_name,
    e.start_at, e.end_at, e.workflow_status
ORDER BY e.title;

SELECT
    vp.id AS brandId,
    vp.brand_name AS brandName,
    c.name AS categoryName,
    COUNT(DISTINCT p.id) AS productCount,
    COUNT(DISTINCT ea.event_id) AS publishedParticipationCount
FROM dbo.vendor_profiles vp
INNER JOIN dbo.categories c ON c.id = vp.category_id
LEFT JOIN dbo.vendor_products p ON p.vendor_profile_id = vp.id
LEFT JOIN dbo.event_applications ea
    ON ea.vendor_profile_id = vp.id
   AND ea.review_status = N'APPROVED'
   AND ea.is_cancelled = 0
WHERE vp.brand_name IN (N'日光小廚房', N'森日手作所')
GROUP BY vp.id, vp.brand_name, c.name
ORDER BY vp.brand_name;
GO
