# = Class: firewall::linux::redhat
#
# Manages the `iptables` service on RedHat-alike systems.
#
# == Parameters:
#
# [*ensure*]
#   Ensure parameter passed onto Service[] resources.
#   Default: running
#
# [*enable*]
#   Enable parameter passed onto Service[] resources.
#   Default: true
#
class firewall::linux::redhat (
  $ensure = running,
  $enable = true
) {
  service { 'iptables':
    ensure    => $ensure,
    enable    => $enable,
    hasstatus => true,
  }
}
