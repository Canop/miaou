require 'beaker-rspec'

def iptables_flush_all_tables
  ['filter', 'nat', 'mangle', 'raw'].each do |t|
    expect(shell("/sbin/iptables -t #{t} -F").stderr).to eq("")
  end
end

def ip6tables_flush_all_tables
  ['filter'].each do |t|
    expect(shell("/sbin/ip6tables -t #{t} -F").stderr).to eq("")
  end
end

hosts.each do |host|
  # Install Puppet
  install_package host, 'rubygems'
  on host, 'gem install puppet --no-ri --no-rdoc'
  on host, "mkdir -p #{host['distmoduledir']}"
end

RSpec.configure do |c|
  # Project root
  proj_root = File.expand_path(File.join(File.dirname(__FILE__), '..'))

  # Readable test descriptions
  c.formatter = :documentation

  # Configure all nodes in nodeset
  c.before :suite do
    # Install module and dependencies
    puppet_module_install(:source => proj_root, :module_name => 'firewall')
    hosts.each do |host|
      shell('/bin/touch /etc/puppet/hiera.yaml')
      shell('puppet module install puppetlabs-stdlib --version 3.2.0', { :acceptable_exit_codes => [0,1] })
    end
  end
end
