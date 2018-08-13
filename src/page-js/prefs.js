
miaou(function(locals, prefs, usr){

	var	valid = locals.valid,
		langs = locals.langs,
		userinfo = locals.userinfo,
		userPrefs = locals.userPrefs,
		tabletop = 250;

	$(document.body).addClass(
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|Mini/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
	);

	miaou.horn.init();

	function getPrefDefinition(key){
		for (var def of locals.prefDefinitions) {
			if (def.key===key) return def;
		}
	}

	var localPrefs = prefs.allLocalPrefs();
	console.log('localPrefs:', localPrefs);

	$("tr[data-pref]").each(function(){
		var key = $(this).data("pref");
		var def = getPrefDefinition(key);
		console.log('def:', def);
		$("<th>").text(def.name).prependTo(this);
		// we allow the preexistence of some content in the tr/td
		var $td = $("td", this);
		if (!$td.length) $td = $("<td>").appendTo(this);
		if (localPrefs[def.key]) {
			$("<span class=pref-help-note>")
			.text(" ")
			.bubbleOn("This preference is overloaded in this browser by a local one. Use !!pref in the chat.")
			.prependTo($td);
		}
		$("<select>").attr({id:key, name:key}).append(def.values.map(
			v => $("<option>").val(v.value).text(v.label)
		)).prependTo($td);
	});

	function selectTab(i){
		if (typeof i === "string" && i!=+i) {
			var tabs = $(".home-tab").map(function(){ return $(this).text().toLowerCase(); }).get();
			i = tabs.indexOf(i.toLowerCase());
			if (i<0) return;
		}
		$('.home-tab').removeClass('selected').filter(':nth-child('+(i+1)+')').addClass('selected');
		var $container = $('#prefs-main-content');
		$container.find('.home-page').removeClass('selected').eq(i).addClass('selected');
		if ($(window).scrollTop()>tabletop) $(window).scrollTop(tabletop);
	}
	if (location.hash) selectTab(location.hash.slice(1));
	else selectTab(0);
	$('.home-tab').click(function(){
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

	// preferences
	Object.keys(userPrefs).forEach(function(key){
		var $input = $('#'+key);
		if ($input.length) {
			$input.val(userPrefs[key]);
		} else {
			// must be radio button based
			// may be missing (not all preferences are accessible in the prefs page)
			$('input[name="'+key+'"][value='+userPrefs[key]+']').prop('checked', true);
		}
	});

	$("#avatar-fields").on("click", "#gravatar-compute-hash", function(){
		var email = $("#gravatar-email").val().trim();
		if (!email) {
			alert("you must give an email");
		} else {
			$.get('json/stringToMd5?input='+encodeURIComponent(email), function(data){
				$("#avatar-key").val(data.md5);
			});
		}
		return false;
	});

	// Avatar preferences management
	var avatarSources = {
		gravatar:{
			keyLabel: 'hash',
			description: 'Gravatar is a free service'+
				' providing avatars. You can upload your portrait'+
				' at <a href=https://gravatar.com target=gravatar>gravatar.com</a>.'+
				'<br>Gravatar hash is computed from your email.'+
				'If you don\'t know your hash, Miaou can compute it for you:',
			postCode: function($con){
				$("<div>").text("email:").appendTo($con).append(
					$("<input id=gravatar-email>").val(locals.email),
					$("<button id=gravatar-compute-hash>").text("compute")
				);
			}
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
	for (key in locals.pluginAvatars) {
		avatarSources[key] = {
			key: locals.pluginAvatars[key]
		}
	}

	function avatarTry(){
		var	srcname = $('#avatar-src').val(),
			src = avatarSources[srcname],
			key = $('#avatar-key').val().trim() || src.key ;
		if (key.length<1) {
			$('#avatar-preview').empty();
			return;
		}
		var url = usr.avatarsrc({
			avs: srcname, avk: key
		});
		$('#avatar-preview').empty();
		$('<img>').on('load', function(){
			$(this).show();
			src.key = key;
			$('#avatar-key').val(key);
		}).on('error', function(){
			$('#avatar-preview').html('<p>Image not found</p>');
		}).attr('src', url).appendTo('#avatar-preview').hide();
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
			if (src.postCode) {
				src.postCode($("<div>").appendTo($('#avatar-src-description')));
			}
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
			if (src.postCode) {
				src.postCode($("<div>").appendTo($('#avatar-src-description')));
			}
		} else {
			$('#avatar-key').val('').hide();
		}
		avatarTry();
	} else {
		onchangeAvatarSrc();
	}
	$('#avatar-try').click(avatarTry);

	$('#try-sound').click(function(){
		miaou.horn.honk($('#volume').val());
	});

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
