################################################################################
# Definition: wget::fetch
#
# This class will download files from the internet.  You may define a web proxy
# using $http_proxy if necessary.
#
################################################################################
define wget::fetch (
  $destination,
  $source             = $title,
  $timeout            = '0',
  $verbose            = false,
  $redownload         = false,
  $nocheckcertificate = false,
  $execuser           = undef,
  $user               = undef,
  $password           = undef,
) {

  include wget

  $http_proxy_env = $::http_proxy ? {
    undef   => [],
    default => [ "HTTP_PROXY=${::http_proxy}", "http_proxy=${::http_proxy}" ],
  }
  $https_proxy_env = $::http_proxy ? {
    undef   => [],
    default => [ "HTTPS_PROXY=${::https_proxy}", "https_proxy=${::https_proxy}" ],
  }
  $password_env = $user ? {
    undef   => [],
    default => [ "WGETRC=${destination}.wgetrc" ],
  }

  # not using stdlib.concat to avoid extra dependency
  $environment = split(inline_template("<%= (@http_proxy_env+@https_proxy_env+@password_env).join(',') %>"),',')

  $verbose_option = $verbose ? {
    true  => '--verbose',
    false => '--no-verbose'
  }

  $unless_test = $redownload ? {
    true  => 'test',
    false => "test -s ${destination}"
  }

  $nocheckcert_option = $nocheckcertificate ? {
    true  => ' --no-check-certificate',
    false => ''
  }

  $user_option = $user ? {
    undef   => '',
    default => " --user=${user}",
  }

  if $user != undef {
    $wgetrc_content = $::operatingsystem ? {
      # This is to work around an issue with macports wget and out of date CA cert bundle.  This requires
      # installing the curl-ca-bundle package like so:
      #
      # sudo port install curl-ca-bundle
      'Darwin' => "password=${password}\nCA_CERTIFICATE=/opt/local/share/curl/curl-ca-bundle.crt\n",
      default  => "password=${password}",
    }

    file { "${destination}.wgetrc":
      owner   => $execuser,
      mode    => '0600',
      content => $wgetrc_content,
      before  => Exec["wget-${name}"],
    }
  }

  exec { "wget-${name}":
    command     => "wget ${verbose_option}${nocheckcert_option}${user_option} --output-document='${destination}' '${source}'",
    timeout     => $timeout,
    unless      => $unless_test,
    environment => $environment,
    user        => $execuser,
    path        => '/usr/bin:/usr/sbin:/bin:/usr/local/bin:/opt/local/bin',
    require     => Class['wget'],
  }
}
