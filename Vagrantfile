VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = "base"
  config.vm.box_url = "http://files.vagrantup.com/precise32.box"
  config.vm.provision :puppet do |puppet|
      puppet.module_path = "vagrant/manifests/modules"
  end
  config.vm.network :forwarded_port, guest: 8204, host: 8204
end
