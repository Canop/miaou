# Class: gcc
#
# This class installs gcc
#
# Parameters:
#
# Actions:
#   - Install the gcc package
#
# Requires:
#
# Sample Usage:
#
class gcc {
 
  include gcc::params

  package { $gcc::params::gcc_package:
    ensure => installed 
  }
}
