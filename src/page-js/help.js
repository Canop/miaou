$(function(){
	let h2hash;
	$('h2, h3').each(function(){
		let hash = $(this).text().replace(/\W+/g, '_');
		if ('#' + hash === location.hash) {
			$('html,body').scrollTop($(this).offset().top);
		}
		if (this.tagName==='H2') h2hash = hash;
		$(this).attr('hash', hash).attr('h2hash', h2hash).clone().appendTo('#help-summary');
	});
	$('h1').click(function(){
		location.hash = '';
		$('body').animate({ scrollTop: 0 }, 500);
		$('#help-summary h3').slideUp();
	});
	$('#help-summary h3').hide();
	$('h2, h3').click(function(){
		let hash = $(this).attr('hash');
		location.hash = '#' + hash;
		$('html,body').animate({
			scrollTop: $('#help-content [hash='+hash+']').offset().top
		}, 500);
		let h2hash = $(this).attr('h2hash');
		$('#help-summary h3').each(function(){
			if ((h2hash===hash && $(this).is(':visible')) || $(this).attr('h2hash')!==h2hash) {
				$(this).slideUp();
			} else {
				$(this).slideDown();
			}
		});
	});
});
