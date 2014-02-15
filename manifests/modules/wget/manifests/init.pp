################################################################################
# Class: wget
#
# This class will install wget - a tool used to download content from the web.
#
################################################################################
class wget (
  $version = present,
) {

  if $::operatingsystem != 'Darwin' {
    if ! defined(Package['wget']) {
      package { 'wget': ensure => $version }
    }
  }
}
