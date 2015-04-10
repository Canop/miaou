
miaou(function(locals){

	var	valid = locals.valid,
		langs = locals.langs,
		userinfo = locals.userinfo,
		userPrefs = locals.userPrefs,
		tabletop = 250;

	$(document.body).addClass(
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|Mini/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
	);

	function selectTab(i){
		$('.tab').removeClass('selected').filter(':nth-child('+(i+1)+')').addClass('selected');
		var $container = $('#prefs-main-content');
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
	$('#name').keyup(function(){
		if (!this.validity.valid) {
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
	$('#submit').hide();
	$('input, select').on("blur keyup change", function(){ $('#submit').show(); });

	$('#description').val(userinfo.description||'');
	$('#location').val(userinfo.location||'');
	$('#url').val(userinfo.url||'');
	$('#lang').val(userinfo.lang);
	$('input[name=notif][value='+userPrefs.notif+']').prop('checked', true);
	$('#sound').val(userPrefs.sound);
	$('#nifvis').val(userPrefs.nifvis);
	$('#theme').val(userPrefs.theme);
	$('input[name=datdpl][value='+userPrefs.datdpl+']').prop('checked', true);

	// Avatar preferences management
	avatarSources = {
		gravatar:{
			keyLabel: 'hash or email',
			description: 'Gravatar is a free service'+
				' providing avatars globally identified by your email. You can upload your portrait'+
				' at <a href=http://gravatar.com target=gravatar>gravatar.com</a>.',
			key: locals.email
		},
		twitter:{
			keyLabel: 'Twitter&nbsp;id'
		},
		facebook:{
			keyLabel: 'Facebook&nbsp;id'
		},
		instagram:{
			keyLabel: 'Instagram&nbsp;id'
		}
	}
	for (var key in locals.pluginAvatars) {
		avatarSources[key] = {
			key: locals.pluginAvatars[key]
		}
		console.log("->",avatarSources[key]);
	}
	function avatarTry(){
		var srcname = $('#avatar-src').val(),
			src = avatarSources[srcname],
			key = src.key || $('#avatar-key').val().trim();
		if (key.length<1){
			$('#avatar-preview').empty();
			return;
		}
		var url = src.keyLabel ? "http://avatars.io/"+srcname+"/"+key+'?size=large' : key;
		console.log("Try", url);
		$('#avatar-preview').empty();
		$('<img>').on('load', function(){
			$(this).show();
			src.key = key;
			$('#avatar-key').val(key);
		}).on('error', function(){
			$('#avatar-preview').html('<p>Image not found</p>');			
		}).attr('src',url).appendTo('#avatar-preview').hide();
	}
	function onchangeAvatarSrc(){
		$('#avatar-preview').empty();
		var src = avatarSources[$('#avatar-src').val()];
		if (src) {
			if (src.keyLabel) {
				$('#avatar-key-label').html(src.keyLabel+':');
				$('#avatar-key').val(src.key||'').show();
			} else {
				$('#avatar-key-label').html('');
				$('#avatar-key').val('').hide();
			}
			$('#avatar-src-description').html(src.description||'');
		} else {
			$('#avatar-key-label').html('');
			$('#avatar-src-description').html('');
			$('#avatar-key').val('').hide();
		}
	}
	$('#avatar-src').append(Object.keys(avatarSources).map(function(key){
		return $('<option>').text(key).val(key);
	})).on('change', onchangeAvatarSrc);
	
	if (locals.avatarsrc) {
		$('#avatar-src').val(locals.avatarsrc);
		$('#avatar-key').val(locals.avatarkey);
		var src = avatarSources[locals.avatarsrc];
		if (src.keyLabel) {
			src.key = locals.avatarkey;
			$('#avatar-key-label').html(src.keyLabel+':');
			$('#avatar-src-description').html(src.description||'');
		} else {
			$('#avatar-key').val('').hide();			
		}
		avatarTry();
	} else {
		onchangeAvatarSrc();
	}
	$('#avatar-try').click(avatarTry);

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
	
});
