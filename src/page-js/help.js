$(function(){
	$('h2, h3').each(function(){
		var hash = '#' + $(this).text().replace(/\W+/g, '_');
		if (hash==location.hash) {
			$('html,body').scrollTop($(this).offset().top);
		}
		$(this).attr('hash',hash).clone().appendTo('#help-summary');
	});
	$('h1').click(function(){
		location.hash = '';
		$('body').animate({ scrollTop: 0 }, 500);
		$('#help-summary h3').slideUp();
	});
	$('#help-summary h3').hide();
	$('h2, h3').click(function(){
		var hash = $(this).attr('hash');
		location.hash = hash;
		$('html,body').animate({
			scrollTop: $('#help-content [hash='+hash+']').offset().top
		}, 500);
	});
	$('#help-summary h2').click(function(){
		var h2 = this;
		$('#help-summary h3').each(function(){
			if ($(this).is(':visible') || $(this).prevAll('h2').first()[0]!==h2) {
				$(this).slideUp();
			} else {
				$(this).slideDown();
			}
		});
	});
	$('#help-content h2').click(function(){
		var h2 = $('#help-summary [hash='+$(this).attr('hash')+']')[0];
		$('#help-summary h3').each(function(){
			if ($(this).prevAll('h2').first()[0]!==h2) {
				$(this).slideUp();
			} else {
				$(this).slideDown();
			}
		});
	});
	$('#help-content h3').click(function(){
		var h2 = $('#help-summary [hash='+$(this).attr('hash')+']').prevAll('h2').first()[0];
		$('#help-summary h3').each(function(){
			if ($(this).prevAll('h2').first()[0]!==h2) {
				$(this).slideUp();
			} else {
				$(this).slideDown();
			}
		});
	});
});
