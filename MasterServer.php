<?php

error_reporting(0);

$db = new SQLite3('../servers.db');
$db->exec('CREATE TABLE IF NOT EXISTS servers (key STRING, time INTEGER, address STRING, port INTEGER, name STRING, haspassword INTEGER, description STRING, version STRING, players INTEGER, maxplayers INTEGER);');

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
		$obj = json_decode($data);
		$key = SQLite3::escapeString($key);
		$name = SQLite3::escapeString($obj->name);
		$haspassword = SQLite3::escapeString($obj->haspassword);
		$description = SQLite3::escapeString($obj->description);
		$version = SQLite3::escapeString($obj->version);
		$players = SQLite3::escapeString($obj->players);
		$maxplayers = SQLite3::escapeString($obj->maxplayers);
		$result = $db->query("SELECT * FROM servers WHERE address = '$address'");
		if($result->fetchArray()){
			$db->exec("UPDATE servers SET key = '$key', time = datetime('now'), name = '$name', haspassword = '$haspassword', description = '$description', version = '$version', players = '$players', maxplayers = '$maxplayers' WHERE address = '$address'");
		}else{
			$db->exec("INSERT INTO servers (key, time, address, port, name, haspassword, description, version, players, maxplayers) VALUES ('$key', datetime('now'), '$address', '$port', '$name', '$haspassword', '$description', '$version', '$players', '$maxplayers')");
		}
	}
}

function remove_old_servers(){
	global $db;
	$result = $db->query("DELETE FROM servers WHERE time < datetime('now', '-70 seconds')");
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
