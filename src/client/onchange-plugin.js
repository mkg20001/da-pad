'use strict'

// credit goes to the brilliant smartmind behind https://stackoverflow.com/a/16922864/3990041

module.exports = function ($) {
  $.fn.wysiwygEvt = function () {
    return this.each(function () {
      var $this = $(this)
      var htmlOld = $this.html()
      $this.bind('blur keyup keypress paste copy cut mouseup', function () {
        var htmlNew = $this.html()
        if (htmlOld !== htmlNew) {
          $this.trigger('change')
          htmlOld = htmlNew
        }
      })
    })
  }
}
