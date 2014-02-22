VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = "base"
  config.vm.box_url = "http://files.vagrantup.com/precise32.box"

  config.vm.provision :shell do |shell|
    # --force is used to prevent errors when provisioning an existing machine
    shell.inline = "mkdir -p /etc/puppet/modules;
                    puppet module install puppetlabs/stdlib --force;
                    puppet module install ripienaar/concat --force;
                    puppet module install maestrodev/wget --force;
                    puppet module install puppetlabs/gcc --force;
                    puppet module install puppetlabs/apt --force;
                    puppet module install puppetlabs/postgresql --force;
                    puppet module install thomasvandoren/redis --force"
  end

  config.vm.provision :puppet do |puppet|
      puppet.manifests_path = "vagrant/manifests"
      puppet.manifest_file = "default.pp"
  end
  config.vm.network :forwarded_port, guest: 8204, host: 8204
end
