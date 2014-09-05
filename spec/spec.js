var expect = chai.expect;

describe("OptiViewer", function() {

  after(function () {
    $(window).scrollTop(0).scrollLeft(0);
  });

  describe("when an <img> with no class 'lazy' is in the page", function() {
    it("should leave it alone and unchanged", function() {
      var notLazyNode = $('#nolazy');

      expect(notLazyNode.attr('src')).to.equal('../assets/spacer.png');
    });
  });

  describe("when an <img> with class 'lazy' and no data-sizes is present", function() {

    //something is wrong with this test because of Mocha scrolling to bottom of page
    xit("should only be a spacer before visible in the viewport", function () {
      var $noSizesNode = $('#nosizes');
      var srcBefore = $noSizesNode.attr('src');
      expect(srcBefore).to.equal('../assets/spacer.png');
    });

    it("should load an image with no suffix after scrolled into view", function() {
      var $noSizesNode = $('#nosizes');

      $noSizesNode.unveil({forceWindow: {top: $noSizesNode.offset().top}});
      var srcAfter = $noSizesNode.attr('src');
      expect(srcAfter).to.equal('../assets/img.jpg');
    });
  });

  describe("when an <img> with class 'lazy' and data-sizes 'lo' is present", function() {

    it("should load an image with suffix '-lo' after scrolled into view", function() {
      var $onlyLoNode = $('#onlylo');

      $onlyLoNode.unveil({forceWindow: {top: $onlyLoNode.offset().top}});
      var srcAfter = $onlyLoNode.attr('src');
      if( $(window).width() < 768 ){
        expect(srcAfter).to.equal('../assets/img-lo.jpg');
      } else {
        expect(srcAfter).to.equal('../assets/spacer.png');
      }

    });
  });

  describe("when an <img> with class 'lazy' and data-sizes 'hi' is present", function() {

    it("should load an image with suffix '-hi' after scrolled into view", function() {
      var $onlyHiNode = $('#onlyhi');

      $onlyHiNode.unveil({forceWindow: {top: $onlyHiNode.offset().top}});
      var srcAfter = $onlyHiNode.attr('src');
      if( $(window).width() >= 768 ){
        expect(srcAfter).to.equal('../assets/img-hi.jpg');
      } else {
        expect(srcAfter).to.equal('../assets/spacer.png');
      }
    });
  });

});
