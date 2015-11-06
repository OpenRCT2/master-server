<?php

error_reporting(0);

class MasterServer {
	public $key;
	public $port;
	public $address;

	function __construct($key, $port=0) {
		$this->key = $key;
		$this->port = +$port;
		$this->address = $_SERVER['REMOTE_ADDR'];

		$this->db = new SQLite3('../servers.db');
		$this->db->exec("CREATE TABLE IF NOT EXISTS servers
						(key STRING, time INTEGER, address STRING,
						port INTEGER, name STRING, haspassword INTEGER,
						description STRING, version STRING, players INTEGER,
						maxplayers INTEGER);");
		$this->db->exec("CREATE UNIQUE INDEX addr_idx ON servers(address, port);");
	}

	public function request_gameinfo($address=null, $port=null) {
		$address = $address ?: $this->address;
		$port = $port ?: $port;

		$NETWORK_COMMAND_GAMEINFO = pack("nN", 4, 9);
		$sock                     = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
		socket_set_option($sock, SOL_SOCKET, SO_SNDTIMEO, array('sec' => 5, 'usec' => 5000));

		if(socket_connect($sock, $address, $port) === TRUE) {
			$info_len = strlen($NETWORK_COMMAND_GAMEINFO);
			if(socket_write($sock, $NETWORK_COMMAND_GAMEINFO, $info_len) == $info_len) {
				if(socket_recv($sock, $size, 2, MSG_WAITALL) == 2) {
					$size = unpack("n", $size)[1];
					$data = '';

					if(socket_recv($sock, $data, $size, MSG_WAITALL) == $size) {
						socket_shutdown($sock);
						// Receive all
						while(socket_recv($sock, $null, 9999, MSG_WAITALL));
						socket_close($sock);

						return trim(substr($data, 4));
					}
				}
			}
		}

		return FALSE;
	}

	public function update_server($data) {
		if($data) {
			$sql  = "INSERT OR REPLACE INTO servers VALUES (:key, DATETIME('NOW'), :address, :port, :name, :haspassword, :description, :version, :players, :maxplayers);";
			$stmt = $this->db->prepare($sql);

			$stmt->bindValue(':key', $this->key);
			$stmt->bindValue(':address', $this->address);
			$stmt->bindValue(':port', $this->port);

			$obj = json_decode($data);
			$stmt->bindValue(':name', $obj->name);
			$stmt->bindValue(':haspassword', $obj->haspassword);
			$stmt->bindValue(':description', $obj->description);
			$stmt->bindValue(':version', $obj->version);
			$stmt->bindValue(':players', $obj->players);
			$stmt->bindValue(':maxplayers', $obj->maxplayers);

			$stmt->execute();
		}
	}

	public function remove_old_servers() {
		$this->db->query("DELETE FROM servers WHERE time < DATETIME('now', '-70 seconds');");
	}

	public function list_servers() {
		$servers = array();
		$result  = $this->db->query("SELECT * FROM servers");
		while($row = $result->fetchArray()) {
			$data = array(
				'address' => "{$row['address']}:{$row['port']}",
				'name' => $row['name'],
				'haspassword' => $row['haspassword'],
				'description' => $row['description'],
				'version' => $row['version'],
				'players' => $row['players'],
				'maxplayers' => $row['maxplayers']
			);
			array_push($servers, $data);
		}

		@header('Content-Type: application/json');
		return $servers;
	}
}

$server = new MasterServer($_GET['key'], +$_GET['port']);
if($server->port > 0){
	$data = $server->request_gameinfo();
	$server->update_server($data);
}else{
	$server->remove_old_servers();
	echo json_encode($server->list_servers());
}
