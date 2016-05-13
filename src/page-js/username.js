miaou(function(locals){

	$(document.body).addClass(
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|Mini/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
	);
	var valid = locals.valid;
	$('#name').focus().keyup(function(){
		if (!this.validity.valid) {
			if (this.value[0]==='-') {
				$('#err').text("A username can't start with an hyphen (\"-\")");
			} else {
				$('#err').text('Please type a name with 3 to 20 standard characters, digits, "_" or "-"');
			}
			$('#submit').hide();
		} else if (/w+[_-]*[iy]+[_-]*s+[_-]*e+[_-]*l+[_-]*[iy]+/i.test(this.value)) {
			$('#err').text('More wisely, less "wisely", please.');
			$('#submit').hide();
		} else {
			$('#err').text('');
			$('#submit').show();
		}
	});
	$('#close').click(function(){ location = 'rooms'; return false; });

	if (!valid) $('#gotochat, #gotoextendedprofile').hide();
	$('#gotochat').click(function(){ location = 'rooms'; return false; });
	$('#gotoextendedprofile').click(function(){ location = 'prefs'; return false; });

});
