class Character:
    def __init__(self, name, hp):
        self.name = name
        self.hp = hp

    def damage(self, amount):
        self.hp = self.hp - amount


party = [Character('용사', 120), Character('마법사', 80), Character('궁수', 95)]
party[1].damage(30)

for member in party:
    print(member.name, member.hp)
