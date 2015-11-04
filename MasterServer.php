<?php

error_reporting(0);

$db = new SQLite3('../servers.db');
$db->exec("CREATE TABLE IF NOT EXISTS servers (key STRING, time INTEGER, address STRING, port INTEGER, name STRING, haspassword INTEGER, description STRING, version STRING, players INTEGER, maxplayers INTEGER);");
$db->exec("CREATE UNIQUE INDEX addr_idx ON servers(address, port);");

$address = $_SERVER['REMOTE_ADDR'];
$port = null;
if (isset($_GET['port'])) {
	$port = intval($_GET['port']);
}
$key = null;
if (isset($_GET['key'])) {
	$key = $_GET['key'];
}

function request_gameinfo($address, $port){
	$NETWORK_COMMAND_GAMEINFO = pack("nN", 4, 9);
	$sock = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
	socket_set_option($sock, SOL_SOCKET, SO_SNDTIMEO, array('sec' => 5, 'usec' => 5000)); 
	if(socket_connect($sock, $address, $port) === true){
		if(socket_write($sock, $NETWORK_COMMAND_GAMEINFO, strlen($NETWORK_COMMAND_GAMEINFO)) == strlen($NETWORK_COMMAND_GAMEINFO)){
			if(socket_recv($sock, $size, 2, MSG_WAITALL) == 2){
				$size = unpack("n", $size)[1];
				$data = '';
				if(socket_recv($sock, $data, $size, MSG_WAITALL) == $size){
					socket_shutdown($sock);
					while(socket_recv($sock, $null, 9999, MSG_WAITALL)) {};
					socket_close($sock);
					return trim(substr($data, 4));
				}
			}
		}
	}
	return FALSE;
}

function update_server($data){
	global $db;
	global $address;
	global $port;
	if($data){
		$stmt = $db->prepare("INSERT OR REPLACE INTO servers VALUES (:key, DATETIME('NOW'), :address, :port, :name, :haspassword, :description, :version, :players, :maxplayers);");

		$stmt->bindValue(':key', $key);
		$stmt->bindValue(':address', $address);
		$stmt->bindValue(':port', $port);
		$stmt->bindValue(':name', $obj->name);
		$stmt->bindValue(':haspassword', $obj->haspassword);
		$stmt->bindValue(':description', $obj->description);
		$stmt->bindValue(':version', $obj->version);
		$stmt->bindValue(':players', $obj->players);
		$stmt->bindValue(':maxplayers', $obj->maxplayers);

		$stmt->execute();
	}
}

function remove_old_servers(){
	global $db;
	$result = $db->query("DELETE FROM servers WHERE time < DATETIME('now', '-70 seconds');");
}

function list_servers(){
	global $db;
	$servers = Array();
	$result = $db->query("SELECT * FROM servers");
	while($row = $result->fetchArray()){
		array_push($servers, Array('address' => "{$row['address']}:{$row['port']}", 'name' => $row['name'], 'haspassword' => $row['haspassword'], 'description' => $row['description'], 'version' => $row['version'], 'players' => $row['players'], 'maxplayers' => $row['maxplayers']));
	}

	echo json_encode($servers);
}

if($port){
	$data = request_gameinfo($address, $port);
	update_server($data);
}else{
	remove_old_servers();
	list_servers();
}

?>
