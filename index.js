const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Load cấu hình
const config = require('./config.json');

// Khởi tạo Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

// Kết nối MongoDB
mongoose.connect(config.mongoURI)
  .then(() => console.log('Kết nối MongoDB thành công'))
  .catch(err => console.error('Lỗi kết nối MongoDB:', err));

// Khởi tạo số thứ tự confession
let confessionCounter = 1; // Bắt đầu từ 1, tăng dần theo số lần gửi confession

// Load lệnh
const commands = new Map();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));
    commands.set(command.data.name, command);
    console.log(`Đã load lệnh: ${command.data.name}`);
  } catch (error) {
    console.error(`Lỗi khi load lệnh từ file ${file}:`, error);
  }
}

// Sự kiện bot sẵn sàng
client.once('clientReady', async () => {
  console.log(`Đăng nhập với tên ${client.user.tag}`);

  // Kiểm tra quyền AttachFiles trong kênh profile
  const profileChannel = client.channels.cache.get(config.profileChannelId || '');
  if (profileChannel) {
    const botPermissions = profileChannel.permissionsFor(client.user);
    if (!botPermissions.has(PermissionFlagsBits.AttachFiles)) {
      console.warn('Cảnh báo: Bot thiếu quyền AttachFiles trong kênh profile (ID: ). Không thể gửi banner.gif.');
    }
  } else {
    console.error('Không tìm thấy kênh profile (ID: )');
  }

  // Đăng ký lệnh slash toàn cầu
  try {
    for (const command of commands.values()) {
      await client.application.commands.create(command.data);
      console.log(`Đã đăng ký lệnh /${command.data.name}`);
    }
  } catch (error) {
    console.error('Lỗi khi đăng ký lệnh:', error);
  }

  // Gọi hàm initPrompt cho từng lệnh để xóa tin nhắn cũ và gửi tin nhắn mới
  for (const command of commands.values()) {
    if (command.initPrompt) {
      try {
        await command.initPrompt(client, config);
      } catch (error) {
        console.error(`Lỗi khi khởi tạo prompt cho lệnh ${command.data.name}:`, error);
      }
    }
  }
});

// Xử lý tương tác
client.on('interactionCreate', async interaction => {
  if (interaction.isCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client, confessionCounter, () => { confessionCounter++; }, config);
    } catch (error) {
      console.error(`Lỗi khi thực thi lệnh ${interaction.commandName}:`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Có lỗi xảy ra khi thực thi lệnh!', ephemeral: true });
      } else {
        await interaction.followUp({ content: 'Có lỗi xảy ra khi thực thi lệnh!', ephemeral: true });
      }
    }
  } else if (interaction.isButton() || interaction.isModalSubmit()) {
    let command;
    if (interaction.customId.startsWith('anonymous') || 
        interaction.customId.startsWith('with_name') || 
        interaction.customId.startsWith('confess_modal_') || 
        interaction.customId.startsWith('approve_') || 
        interaction.customId.startsWith('reject_')) {
      command = commands.get('confess');
    } else if (interaction.customId === 'hotro_button' || 
               interaction.customId === 'hotro_modal' || 
               interaction.customId === 'close_ticket') {
      command = commands.get('hotro');
    } else if (interaction.customId === 'profile_button' || 
               interaction.customId === 'profile_modal') {
      command = commands.get('profile');
    }

    if (command) {
      try {
        await command.execute(interaction, client, confessionCounter, () => { confessionCounter++; }, config);
      } catch (error) {
        console.error(`Lỗi khi xử lý tương tác ${interaction.customId}:`, error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Có lỗi xảy ra khi xử lý tương tác!', ephemeral: true });
        } else {
          await interaction.followUp({ content: 'Có lỗi xảy ra khi xử lý tương tác!', ephemeral: true });
        }
      }
    }
  }
});

// Đăng nhập vào Discord
client.login(config.token);