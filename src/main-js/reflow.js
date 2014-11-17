// WebKit sometimes forget to reflow an element when the size of some child changes
// See http://stackoverflow.com/questions/3485365/how-can-i-force-webkit-to-redraw-repaint-to-propagate-style-changes
// This function forces the reflow. One can only hope I'll be able to remove it some day...

if ('WebkitAppearance' in document.documentElement.style) {
	$.fn.reflow = function(){
		this.each(function(){
			this.style.display = 'none';
			this.offsetHeight;
			this.style.display = '';
		});
	}
} else {
	$.fn.reflow = function(){}; // noop
}
