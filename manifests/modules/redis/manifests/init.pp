# == Class: redis
#
# Install and configure redis.
#
# === Parameters
#
# [*redis_port*]
#   Accept redis connections on this port.
#   Default: 6379
#
# [*redis_bind_address*]
#   Address to bind to.
#   Default: false, which binds to all interfaces
#
# [*version*]
#   Version to install.
#   Default: 2.4.13
#
# [*redis_src_dir*]
#   Location to unpack source code before building and installing it.
#   Default: /opt/redis-src
#
# [*redis_bin_dir*]
#   Location to install redis binaries.
#   Default: /opt/redis
#
# [*redis_max_memory*]
#   Set the redis config value maxmemory (bytes).
#   Default: 4gb
#
# [*redis_max_clients*]
#   Set the redis config value maxclients. If no value provided, it is
#   not included in the configuration for 2.6 and set to 0 (unlimited)
#   for 2.4.
#   Default: 0 (2.4)
#   Default: nil (2.6)
#
# [*redis_timeout*]
#   Set the redis config value timeout (seconds).
#   Default: 300
#
# [*redis_loglevel*]
#   Set the redis config value loglevel. Valid values are debug,
#   verbose, notice, and warning.
#   Default: notice
#
# [*redis_databases*]
#   Set the redis config value databases.
#   Default: 16
#
# [*redis_slowlog_log_slower_than*]
#   Set the redis config value slowlog-log-slower-than (microseconds).
#   Default: 10000
#
# [*redis_showlog_max_len*]
#   Set the redis config value slowlog-max-len.
#   Default: 1024
#
# [*redis_password*]
#   Password used by AUTH command. Will be setted is its not nil.
#   Default: nil
#
# === Examples
#
# include redis
#
# class { 'redis':
#   version          => '2.6.4',
#   redis_max_memory => '64gb',
# }
#
# === Authors
#
# Thomas Van Doren
#
# === Copyright
#
# Copyright 2012 Thomas Van Doren, unless otherwise noted.
#
class redis (
  $redis_port = '6379',
  $redis_bind_address = false,
  $version = '2.4.13',
  $redis_src_dir = '/opt/redis-src',
  $redis_bin_dir = '/opt/redis',
  $redis_max_memory = '4gb',
  $redis_max_clients = false,
  $redis_timeout = 300,         # 0 = disabled
  $redis_loglevel = 'notice',
  $redis_databases = 16,
  $redis_slowlog_log_slower_than = 10000, # microseconds
  $redis_slowlog_max_len = 1024,
  $redis_password = false
  ) {

  include wget
  include gcc

  case $version {
    /^2\.4\.\d+$/: {
      if ($redis_max_clients == false) {
        $real_redis_max_clients = 0
      }
      else {
        $real_redis_max_clients = $redis_max_clients
      }
    }
    /^2\.6\.\d+$/: {
      $real_redis_max_clients = $redis_max_clients
    }
    default: {
      fail("Invalid redis version, ${version}. It must match 2.4.\\d+ or 2.6.\\d+.")
    }
  }
  $redis_pkg_name = "redis-${version}.tar.gz"
  $redis_pkg = "${redis_src_dir}/${redis_pkg_name}"

  File {
    owner => root,
    group => root,
  }
  file { $redis_src_dir:
    ensure => directory,
  }
  file { '/etc/redis':
    ensure => directory,
  }
  file { 'redis-lib':
    ensure => directory,
    path   => '/var/lib/redis',
  }
  file { 'redis-lib-port':
    ensure => directory,
    path   => "/var/lib/redis/${redis_port}",
  }

  # If the version is 2.4.13, use the tarball that ships with the
  # module.
  if ($version == '2.4.13') {
    file { 'redis-pkg':
      ensure => present,
      path   => $redis_pkg,
      mode   => '0644',
      source => 'puppet:///modules/redis/redis-2.4.13.tar.gz',
    }
  }
  exec { 'get-redis-pkg':
    command => "/usr/bin/wget --output-document ${redis_pkg} http://redis.googlecode.com/files/${redis_pkg_name}",
    unless  => "/usr/bin/test -f ${redis_pkg}",
    require => File[$redis_src_dir],
  }
  file { 'redis-init':
    ensure  => present,
    path    => "/etc/init.d/redis_${redis_port}",
    mode    => '0755',
    content => template('redis/redis.init.erb'),
    notify  => Service['redis'],
  }
  file { 'redis_port.conf':
    ensure  => present,
    path    => "/etc/redis/${redis_port}.conf",
    mode    => '0644',
    content => template('redis/redis_port.conf.erb'),
  }
  file { 'redis.conf':
    ensure => present,
    path   => '/etc/redis/redis.conf',
    mode   => '0644',
    source => 'puppet:///modules/redis/redis.conf',
  }
  file { 'redis-cli-link':
    ensure => link,
    path   => '/usr/local/bin/redis-cli',
    target => "${redis_bin_dir}/bin/redis-cli",
  }

  exec { 'unpack-redis':
    command => "tar --strip-components 1 -xzf ${redis_pkg}",
    cwd     => $redis_src_dir,
    path    => '/bin:/usr/bin',
    unless  => "test -f ${redis_src_dir}/Makefile",
    require => Exec['get-redis-pkg'],
  }
  exec { 'install-redis':
    command => "make && make install PREFIX=${redis_bin_dir}",
    cwd     => $redis_src_dir,
    path    => '/bin:/usr/bin',
    unless  => "test $(${redis_bin_dir}/bin/redis-server --version | cut -d ' ' -f 1) = 'Redis'",
    require => [ Exec['unpack-redis'], Class['gcc'] ],
  }

  service { 'redis':
    ensure    => running,
    name      => "redis_${redis_port}",
    enable    => true,
    require   => [ File['redis_port.conf'], File['redis.conf'], File['redis-init'], File['redis-lib-port'], Exec['install-redis'] ],
    subscribe => File['redis_port.conf'],
  }
}
