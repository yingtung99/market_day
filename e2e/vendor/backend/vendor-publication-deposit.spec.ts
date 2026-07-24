import { test } from '../../fixtures';

test.describe('攤主公開資訊與保證金', () => {
  test.skip('VENDOR-PUBLIC-01 最終名單確認前不公開品牌與攤位', async () => {
    // 需要可控制最終名單狀態的活動 fixture 與一般使用者前台 API。
  });

  test.skip('VENDOR-PUBLIC-02 最終名單後公開品牌、攤位及最多 3 筆代表商品', async () => {
    // 需要 event-finalized fixture；目前商品後台也仍直接限制為 3 筆。
  });

  test.skip('VENDOR-DEPOSIT-01 主辦方登記退還後攤主顯示保證金已退還', async () => {
    // 需要活動結束及主辦方保證金操作 fixture，不執行現場款項操作。
  });

  test.skip('VENDOR-DEPOSIT-02 不退保證金時顯示原因且不誤標已退還', async () => {
    // 現場驗收屬人工事實，E2E 只驗證主辦方記錄後的攤主端結果。
  });
});
