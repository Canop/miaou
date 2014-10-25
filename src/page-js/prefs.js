

$(document.body).addClass(
	/Android|webOS|iPhone|iPad|iPod|BlackBerry|Mini/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
);

function selectTab(i) {
	$('.tab').removeClass('selected').filter(':nth-child('+(i+1)+')').addClass('selected');
	var $container = $('#home-main-content');
	$container.find('.page').removeClass('selected').eq(i).addClass('selected');
	if ($(window).scrollTop()>tabletop) $(window).scrollTop(tabletop);
}
if (location.hash==="#notifs") selectTab(2);
else selectTab(0);
$('.tab').click(function(){
	selectTab($(this).index());
});			
$('#logout').click(function(){
	delete localStorage['successfulLoginLastTime'];
	setTimeout(function(){ location = 'logout' }, 100);
});

for (var key in langs) {
	var lang = langs[key];
	$('#lang').append($('<option>').attr('value', key).text(lang.name));
}
$('#name').focus().keyup(function(){
	if (!this.validity.valid){ // not compatible with IE, that's fine 
		$('#err').text('Please type a name with 3 to 20 standard characters, digits, "_" or "-"');
		$('#submit').prop('disabled', true);
	} else if (/w+[_-]*[iy]+[_-]*s+[_-]*e+[_-]*l+[_-]*[iy]+/i.test(this.value)) {
		$('#err').text('More wisely, less "wisely", please.');
		$('#submit').prop('disabled', true);
	} else {
		$('#err').text('');
		$('#submit').prop('disabled', false);
	}
});
$('#description').val(userinfo.description||'');
$('#location').val(userinfo.location||'');
$('#url').val(userinfo.url||'');
$('#lang').val(userinfo.lang);
$('input[name=notif][value='+userPrefs.notif+']').prop('checked', true);
$('#sound').val(userPrefs.sound);
$('input[name=datdpl][value='+userPrefs.datdpl+']').prop('checked', true);

if (!valid) $('#close').hide();

var roomMatch = location.href.match(/(\?|&)room=(\d+)/);
if (roomMatch) {
	$('#close').text("Back to room").click(function(){
		location=roomMatch[2];
		return false;		
	});
} else {
	$('#close').click(function(){
		location='rooms';
		return false;
	});
}
