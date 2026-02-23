function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("NVIDIA Session Hub")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
